import json

import numpy as np
import pandas as pd
import pytest
from scipy.integrate import quad
from scipy.stats import genpareto

from angel_forecast import newest_release, input_window, gpd_summary, validate_manifest


def test_selection_export_preserves_order_weights_mask_and_excludes_target():
    import torch
    from angel_forecast import selection_payload
    diagnostics = {'feature_names':['a','b','c'],
                   'selection_weights':torch.tensor([[.25,.75,0.]]),
                   'selection_mask':torch.tensor([[True,True,False]])}
    result=selection_payload({'interpretability':diagnostics},['a','b','c','depeg_bps'],
                             '2026-11-03T08:00:00Z',168)
    assert result['weight_sum']==1 and result['selected_covariates']==2
    assert [r['feature'] for r in result['features']]==['a','b','c']
    assert [r['rank'] for r in result['features']]==[2,1,3]
    assert result['features'][2]['selected'] is False
    assert pd.Timestamp(result['window_start'])==pd.Timestamp('2026-10-27T09:00:00Z')
    diagnostics['feature_names']=['b','a','c']
    with pytest.raises(ValueError,match='feature order'):
        selection_payload({'interpretability':diagnostics},['a','b','c','depeg_bps'],'2026-11-03',168)


@pytest.mark.parametrize('weights',[[[.5,.6]],[[.5,-.5]],[[float('nan'),1.]],[[.5,.5],[.5,.5]]])
def test_selection_export_rejects_invalid_weights(weights):
    import torch
    from angel_forecast import selection_payload
    with pytest.raises(ValueError,match='selection'):
        selection_payload({'interpretability':{'selection_weights':torch.tensor(weights)}},
                          ['a','b','depeg_bps'],'2026-11-03',168)


def test_nonmatching_release_alpha_is_rejected_before_loading_checkpoint():
    with pytest.raises(ValueError,match='alpha=0.1'):
        validate_manifest({'schema_version':1,'model':'ANGEL','alpha':.4})
    with pytest.raises(ValueError,match='alpha=0.1'):
        validate_manifest({'schema_version':1,'model':'ANGEL','alpha':.1,
                           'input_columns':['Gegenbauer_0.4_deg0','depeg_bps']})


def test_release_selection_uses_publication_time_and_ignores_unfinished_releases():
    def release(tag, date, **kwargs):
        return dict(tag_name=tag,published_at=date,assets=[{'name':'ammonitor-angel.json'}],**kwargs)
    old=release('z-old','2026-11-01T12:00:00Z')
    new=release('a-new','2026-11-03T12:00:00Z')
    draft=release('draft','2026-11-04T12:00:00Z',draft=True)
    pre=release('pre','2026-11-05T12:00:00Z',prerelease=True)
    unrelated=dict(tag_name='data',published_at='2026-11-06T12:00:00Z',assets=[])
    assert newest_release([old,draft,unrelated,pre,new])['tag_name']=='a-new'
    with pytest.raises(ValueError,match='No published'):
        newest_release([draft,pre,unrelated])


def test_live_window_does_not_require_future_labels_and_handles_microsecond_parquet_index():
    index=pd.date_range('2026-11-01',periods=200,freq='h',tz='UTC').as_unit('us')
    df=pd.DataFrame({'feature':np.arange(200),'depeg_bps':1.},index=index)
    manifest={'input_columns':['feature','depeg_bps'],'sequence_length':168}
    values=input_window(df,manifest)
    assert values.shape==(168,2) and values[-1,0]==199
    with pytest.raises(ValueError,match='consecutive'):
        input_window(df.drop(df.index[-20]),manifest)
    df.iloc[-1,0]=np.nan
    with pytest.raises(ValueError,match='missing'):
        input_window(df,manifest)


@pytest.mark.parametrize('center',[-10.,0.,10.])
@pytest.mark.parametrize('alpha',[.01,.005])
@pytest.mark.parametrize('xi',[0.,.3])
def test_gpd_es_and_clipped_token_losses_match_full_tail_integrals(center,alpha,xi):
    beta=1.5; xL=center-1; xU=center+1; splice=.1
    excess=genpareto.ppf(1-alpha/splice,xi,scale=beta)
    lower,upper=xL-excess,xU+excess
    out=gpd_summary(lower,upper,xi,xi,beta,beta,xL,xU,alpha)
    def qlow(u):return xL-genpareto.isf(u/splice,xi,scale=beta)
    def qhigh(u):return xU+genpareto.isf(u/splice,xi,scale=beta)
    def integrate(fn):
        return quad(lambda t: fn(alpha*t**4)*4*t**3,0,1,epsabs=1e-10)[0]
    eslow=integrate(qlow)
    eshigh=integrate(qhigh)
    assert out['lower_es_bps']==pytest.approx(eslow,rel=1e-7)
    assert out['upper_es_bps']==pytest.approx(eshigh,rel=1e-7)
    for token,quantile,sign in [('USDC',qlow,-1),('USDT',qhigh,1)]:
        expected=integrate(lambda u:max(sign*quantile(u),0))
        assert out[token]['es_bps']==pytest.approx(expected,rel=1e-5,abs=1e-8)
        assert out[token]['es_bps']>=out[token]['var_bps']>=0
    with pytest.raises(ValueError,match='infinite ES'):
        gpd_summary(lower,upper,1.,xi,beta,beta,xL,xU,alpha)


def test_fear_greed_sampling_uses_utc(monkeypatch):
    from angel_forecast import runtime_modules
    _,_,builder=runtime_modules()
    class Response:
        def json(self):
            return {'data':[{'timestamp':str(int(pd.Timestamp('2026-11-02',tz='UTC').timestamp())), 'value':'37'}]}
    monkeypatch.setattr(builder.requests,'get',lambda **kwargs:Response())
    result=builder.fear_greed_index()
    assert result.index[0]==pd.Timestamp('2026-11-02T00:00:00Z')
    assert result.iloc[0]==37


def test_download_bundle_validates_hashes_and_repairs_corrupt_cache(tmp_path, monkeypatch):
    import hashlib
    import requests
    from angel_forecast import download_bundle
    checkpoint,state=b'checkpoint',b'frozen-state'
    digest=lambda b:hashlib.sha256(b).hexdigest()
    manifest={'schema_version':1,'model':'ANGEL','input_columns':['depeg_bps'],
        'sequence_length':168,'forecast_horizon':24,'alpha':.1,
        'target':{'units':'basis_points','transformation':'raw; no log transformation'},
        'training_data_end_utc':'2026-11-02T08:00:00Z',
        'preprocessing_fitting_cutoff_utc':'2025-05-21T10:00:00Z',
        'checkpoint_asset':'angel.ckpt','checkpoint_sha256':digest(checkpoint),
        'preprocessing_asset':'angel_preprocessing.npz','preprocessing_sha256':digest(state)}
    blobs={'angel.ckpt':checkpoint,'angel_preprocessing.npz':state,
           'ammonitor-angel.json':json.dumps(manifest).encode()}
    assets=[dict(name=k,browser_download_url='https://example.test/'+k,digest='sha256:'+digest(v))
            for k,v in blobs.items()]
    release=dict(id=42,tag_name='new',html_url='https://example.test/release',
                 published_at='2026-11-03T09:00:00Z',assets=assets)
    class Response:
        links={}
        def __init__(self,data=None,blob=None):self.data,self.blob=data,blob
        def raise_for_status(self):pass
        def json(self):return self.data
        def iter_content(self,size):yield self.blob
    class Session:
        def get(self,url,**kwargs):
            return Response(data=[release]) if 'api.github.com' in url else Response(blob=blobs[url.rsplit('/',1)[-1]])
    monkeypatch.setattr(requests,'Session',Session)
    _,cp,prep,provenance=download_bundle(tmp_path)
    assert cp.read_bytes()==checkpoint and prep.read_bytes()==state
    assert provenance['tag']=='new'
    cp.write_bytes(b'corrupt')
    download_bundle(tmp_path)
    assert cp.read_bytes()==checkpoint
    # Changing the asset while retaining the advertised hash must fail closed.
    cp.unlink()
    blobs['angel.ckpt']=b'tampered'
    with pytest.raises(ValueError,match='SHA256 mismatch'):
        download_bundle(tmp_path)
