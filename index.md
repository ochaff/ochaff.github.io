---
layout: default
title: Owen Chaffard
---

<section class="hero" aria-labelledby="intro-title">
  <div class="hero-copy">
    <p class="eyebrow">Forecasting · hierarchical time series · digital markets</p>
    <h1 id="intro-title">Making markets<br><em>legible</em> with data.</h1>
    <p class="hero-intro">I work on forecasting, the structure of time series, and the onchain conditions that shape stablecoin risk.</p>
    <div class="hero-actions" aria-label="Profile links">
      <a class="button button-primary" href="{{ '/depeg-monitor.html' | relative_url }}">Open depeg monitor <span aria-hidden="true">↗</span></a>
      <a class="button button-secondary" href="https://github.com/{{ site.github_username }}" rel="me">GitHub <span aria-hidden="true">↗</span></a>
      <a class="text-link" href="{{ '/cv.pdf' | relative_url }}">Curriculum vitae <span aria-hidden="true">↓</span></a>
    </div>
  </div>
  <div class="hero-visual" aria-label="Illustration of time-series forecasts and market signals">
    <div class="chart-label chart-label-top">FORECAST WINDOW</div>
    <svg viewBox="0 0 480 310" role="img" aria-hidden="true">
      <defs><linearGradient id="forecast-fill" x1="0" x2="1"><stop stop-color="currentColor" stop-opacity=".2"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
      <g class="chart-grid"><path d="M8 42H472M8 108H472M8 174H472M8 240H472"/><path d="M82 12V274M198 12V274M314 12V274M430 12V274"/></g>
      <path class="chart-band" d="M274 130C319 111 374 130 472 72V242C391 263 323 213 274 230Z" fill="url(#forecast-fill)"/>
      <path class="chart-line chart-line-main" d="M8 211C35 188 52 222 80 183S126 135 151 153S183 203 211 167S246 114 275 131S319 178 347 144S393 161 421 106S452 72 472 92"/>
      <path class="chart-line chart-line-alt" d="M8 234C38 219 56 231 80 207S124 173 151 181S183 216 211 193S248 149 275 169S318 207 347 180S391 187 421 142S451 123 472 132"/>
      <path class="chart-divider" d="M275 20V270"/><circle class="signal-dot" cx="275" cy="131" r="7"/>
    </svg>
    <div class="chart-label chart-label-bottom">OBSERVED <span>→</span> PROJECTED</div>
  </div>
</section>

<section class="live-section" id="monitor" aria-labelledby="monitor-title">
  <div class="section-kicker"><span class="live-pulse" aria-hidden="true"></span> Live deployment / dashboard</div>
  <a class="live-card" href="{{ '/depeg-monitor.html' | relative_url }}">
    <div class="live-card-copy">
      <p class="eyebrow">Stablecoin risk intelligence</p>
      <h2 id="monitor-title">Depeg monitor</h2>
      <p>Track onchain liquidity conditions and model-based depeg risk signals across stablecoin markets.</p>
      <span class="card-link">Explore the live dashboard <span aria-hidden="true">→</span></span>
    </div>
    <div class="home-risk" aria-label="Live 24-hour depeg probability">
      <span class="home-risk-kicker">24H DEPEG PROBABILITY</span>
      <div class="risk-orb" id="home-risk-orb"><div class="risk-orb-inner"><strong class="risk-orb-value" id="home-risk-value">—</strong><span class="risk-orb-label">next 24 h</span></div></div>
      <span class="home-risk-meta" id="home-risk-meta">Loading live model output</span>
    </div>
  </a>
</section>

<section class="portfolio-section" id="explorations" aria-labelledby="explorations-title">
  <div class="section-heading"><div><p class="eyebrow">Visual explorations</p><h2 id="explorations-title">The patterns beneath the series.</h2></div><a class="archive-link" href="{{ '/archive.html' | relative_url }}">All writing <span aria-hidden="true">→</span></a></div>
  <div class="explore-grid">
    {% for post in site.posts limit: 2 %}
      <article class="explore-card">
        <a class="explore-image" href="{{ post.url | relative_url }}" aria-label="Read {{ post.title }}">
          {% if post.categories contains 'Time series' %}
            <img src="{{ '/figures/Hierarchical_TS.png' | relative_url }}" alt="Hierarchy diagram for time-series data" loading="lazy">
          {% else %}
            <img src="https://raw.githubusercontent.com/QuantLet/onchain-insights/main/3.%20Uniswap%20liquidity%20curve/liquidity_cliff.png" alt="Onchain stablecoin liquidity curve" loading="lazy">
          {% endif %}
        </a>
        <div class="explore-body"><p class="post-card-meta">{{ post.categories | default: 'Research note' | join: ', ' }}</p><h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3><p>{{ post.description | default: post.excerpt | strip_html | strip_newlines | truncate: 136 }}</p><a class="card-link" href="{{ post.url | relative_url }}">Read exploration <span aria-hidden="true">→</span></a></div>
      </article>
    {% endfor %}
  </div>
</section>

<section class="portfolio-section split-section" aria-label="Talks and open source work">
  <article class="feature-card talk-card">
    <div class="network-visual" aria-hidden="true"><svg viewBox="0 0 280 175" fill="none" xmlns="http://www.w3.org/2000/svg"><g class="network-links"><path d="M33 120L92 42L153 82L237 35M33 120L153 82L221 139M92 42L221 139M153 82L237 35"/></g><g class="network-nodes"><circle cx="33" cy="120" r="12"/><circle cx="92" cy="42" r="18"/><circle cx="153" cy="82" r="10"/><circle cx="237" cy="35" r="14"/><circle cx="221" cy="139" r="17"/></g></svg></div>
    <p class="eyebrow">Teaching / research talks</p>
    <h2>From networks to market structure.</h2>
    <p>A visual introduction to graph centrality measures for Quantinar.</p>
    <a class="card-link" href="https://quantinar.com/coursecontent/100040/graph-centrality-measures" target="_blank" rel="noreferrer">Watch on Quantinar <span aria-hidden="true">↗</span></a>
  </article>
  <article class="feature-card code-card">
    <a class="code-image" href="https://github.com/QuantLet/onchain-insights" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/QuantLet/onchain-insights/main/3.%20Uniswap%20liquidity%20curve/liquidity_cliff.png" alt="Illustrative stablecoin liquidity curve generated by the onchain-insights Quantlet" loading="lazy"></a>
    <p class="eyebrow">Open source code snippets / Quantlets</p>
    <h2>Onchain insights, made reproducible.</h2>
    <p>Open code for studying decentralized-finance metrics and stablecoin depeg risk.</p>
    <a class="card-link" href="https://github.com/QuantLet/onchain-insights" target="_blank" rel="noreferrer">Explore the Quantlet <span aria-hidden="true">↗</span></a>
  </article>
</section>

<section class="data-band" aria-labelledby="data-title">
  <div><p class="eyebrow">Open data commitment</p><h2 id="data-title">Research should be inspectable.</h2></div>
  <div class="data-links"><a href="https://zenodo.org/records/22037835" target="_blank" rel="noreferrer">Zenodo record 22037835 <span aria-hidden="true">↗</span></a><a href="https://zenodo.org/records/20120190" target="_blank" rel="noreferrer">Zenodo record 20120190 <span aria-hidden="true">↗</span></a></div>
</section>

<section class="contact-band" aria-label="Get in touch"><p>Interested in research, data, or a good forecasting problem?</p><div><a href="https://www.linkedin.com/in/{{ site.linkedin_username }}/" rel="me">LinkedIn <span aria-hidden="true">↗</span></a><a href="mailto:{{ site.email }}">{{ site.email }} <span aria-hidden="true">↗</span></a></div></section>

<script>
  (function () {
    fetch("{{ '/dashboard_data/rf_results.json' | relative_url }}?v=" + Date.now())
      .then(function (response) { if (!response.ok) throw new Error('Live data unavailable'); return response.json(); })
      .then(function (data) {
        var probability = Math.max(0, Math.min(1, Number(data.probability)));
        document.getElementById('home-risk-orb').style.setProperty('--risk', (probability * 360) + 'deg');
        document.getElementById('home-risk-value').textContent = (probability * 100).toFixed(1) + '%';
        document.getElementById('home-risk-meta').textContent = probability >= .55 ? 'Elevated risk signal' : probability >= .25 ? 'Moderate risk signal' : 'Low risk signal';
      })
      .catch(function () { document.getElementById('home-risk-meta').textContent = 'Live data temporarily unavailable'; });
  }());
</script>
