---
layout: default
title: Owen Chaffard
---

<section class="hero" aria-labelledby="intro-title">
  <div class="hero-copy">
    <p class="hero-subjects">Probabilistic forecasting <span>·</span> Hierarchical time series <span>·</span> Blockchain <span>·</span> Financial risk</p>
    <h1 id="intro-title">Owen Chaffard</h1>
    <p class="hero-intro">I am a PhD student interested in forecasting and in understanding the structure of time series. I build visual representations of complex concepts and aim to make research and data more open.</p>
    <div class="hero-actions" aria-label="Profile links">
      <a class="button button-primary scholar-button" href="https://scholar.google.com/citations?user=jGhPf-wAAAAJ&amp;hl=en" target="_blank" rel="noreferrer">Google Scholar <span aria-hidden="true">↗</span></a>
      <a class="button button-secondary" href="https://github.com/{{ site.github_username }}" rel="me">GitHub <span aria-hidden="true">↗</span></a>
      <a class="button button-secondary" href="{{ '/cv.pdf' | relative_url }}">Curriculum vitae <span aria-hidden="true">↓</span></a>
    </div>
  </div>
  <div class="hero-logo"><img src="{{ '/assets/msca-q2-digital-logo.png' | relative_url }}" alt="MSCA Q2 Digital logo"></div>
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
  <div class="section-heading"><h2 id="explorations-title">Visual explorations</h2><a class="archive-link" href="{{ '/archive.html' | relative_url }}">All writings <span aria-hidden="true">→</span></a></div>
  <div class="explore-grid">
    {% for post in site.posts limit: 2 %}
      <article class="explore-card">
        <a class="explore-image" href="{{ post.url | relative_url }}" aria-label="Read {{ post.title }}">
          {% if post.categories contains 'Time series' %}
            <img src="{{ '/assets/exploration-previews/hierarchical-time-series.png' | relative_url }}" alt="Hierarchical time-series forecast visualisation" loading="lazy">
          {% else %}
            <img src="https://raw.githubusercontent.com/QuantLet/onchain-insights/main/3.%20Uniswap%20liquidity%20curve/liquidity_cliff.png" alt="Onchain stablecoin liquidity curve" loading="lazy">
          {% endif %}
        </a>
        <div class="explore-body"><p class="post-card-meta">{% if post.series %}{{ post.series }} · Part {{ post.series_part | default: 1 }}{% else %}{{ post.categories | default: 'Research note' | join: ', ' }}{% endif %}</p><h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3><p>{{ post.description | default: post.excerpt | strip_html | strip_newlines | truncate: 136 }}</p><a class="card-link" href="{{ post.url | relative_url }}">Read exploration <span aria-hidden="true">→</span></a></div>
      </article>
    {% endfor %}
  </div>
</section>

<section class="portfolio-section plain-section" id="teachings" aria-labelledby="teachings-title">
  <div class="section-heading"><h2 id="teachings-title">Teachings</h2><a class="archive-link" href="https://quantinar.com/instructor/73fdfda6-321c-4d08-83d5-ed729193d6c5" target="_blank" rel="noreferrer">All talks <span aria-hidden="true">↗</span></a></div>
  <div class="resource-grid talk-grid">
    <a class="resource-card" href="https://quantinar.com/course/1042/hierarchy-aware-probabilistic-forecasting-in-financial-markets" target="_blank" rel="noreferrer"><img src="{{ '/assets/talk-previews/hierarchy-aware-probabilistic-forecasting-in-financial-markets.jpeg' | relative_url }}" alt="Preview for Hierarchy Aware Forecasting in Financial Markets" loading="lazy"><div><h3>Hierarchy Aware Forecasting in Financial Markets</h3><p>This talk provides an introduction to hierarchical time series with probabilistic forecasting applications. Visualizations and geometric arguments show the value of hierarchical constraints for forecasting.</p><span class="card-link">View talk <span aria-hidden="true">↗</span></span></div></a>
    <a class="resource-card" href="https://quantinar.com/course/891/hierarchical-loan-forecasting?q=Hierarchical%20Loan%20Forecasting" target="_blank" rel="noreferrer"><img src="{{ '/assets/talk-previews/hierarchical-loan-forecasting.jpeg' | relative_url }}" alt="Preview for Hierarchical Loan Forecasting" loading="lazy"><div><h3>Hierarchical Loan Forecasting</h3><p>This talk explores end-to-end reconciled probabilistic forecasting methods for financial hierarchical time series.</p><span class="card-link">View talk <span aria-hidden="true">↗</span></span></div></a>
    <a class="resource-card" href="https://quantinar.com/course/991/proper-scoring-rules" target="_blank" rel="noreferrer"><img src="{{ '/assets/talk-previews/proper-scoring-rules.jpeg' | relative_url }}" alt="Preview for Proper Scoring Rules" loading="lazy"><div><h3>Proper Scoring Rules</h3><p>This talk introduces proper scoring rules for probabilistic forecast evaluation, including discrimination, multivariate scoring rules, and applications.</p><span class="card-link">View talk <span aria-hidden="true">↗</span></span></div></a>
    <a class="resource-card" href="https://quantinar.com/course/1064/stabilising-stablecoin-risks" target="_blank" rel="noreferrer"><img src="{{ '/assets/talk-previews/stablising-stablecoin-risks.jpeg' | relative_url }}" alt="Preview for Stabilising Stablecoin Risks" loading="lazy"><div><h3>Stabilising Stablecoin Risks</h3><p>This talk introduces the onchain mechanisms that determine stablecoin prices and a two-pronged model for stablecoin risk monitoring in an AMM pool.</p><span class="card-link">View talk <span aria-hidden="true">↗</span></span></div></a>
    <a class="resource-card" href="https://quantinar.com/course/100035/a-technical-introduction-to-polymarket" target="_blank" rel="noreferrer"><img src="{{ '/assets/talk-previews/a-technical-introduction-to-polymarket.jpeg' | relative_url }}" alt="Preview for Polymarket: A technical Introduction" loading="lazy"><div><h3>Polymarket: A technical Introduction</h3><p>This talk provides a technical introduction to Polymarket’s onchain aspects and data collection using subgraphs.</p><span class="card-link">View talk <span aria-hidden="true">↗</span></span></div></a>
  </div>
</section>

<section class="portfolio-section plain-section" id="code" aria-labelledby="code-title">
  <div class="section-heading"><h2 id="code-title">Open source code</h2><a class="archive-link" href="https://quantlet.com/SearchResult?query=Owen%20Chaffard" target="_blank" rel="noreferrer">All reproducible codes <span aria-hidden="true">↗</span></a></div>
  <div class="resource-grid code-grid">
    <a class="resource-card" href="https://github.com/QuantLet/onchain-insights" target="_blank" rel="noreferrer"><img src="{{ '/assets/code-previews/onchain-insight-code.png' | relative_url }}" alt="Onchain insights code output" loading="lazy"><div><h3>Onchain insights</h3><p>Reproducible code for studying onchain liquidity conditions, including functional analysis of the Uniswap liquidity curve and a probabilistic neural-network forecaster for stablecoin tail risk.</p><p class="companion">Companion code to Stabilising Stablecoin Risks.</p><span class="card-link">View code <span aria-hidden="true">↗</span></span></div></a>
    <a class="resource-card" href="https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data" target="_blank" rel="noreferrer"><img src="{{ '/assets/code-previews/hierarchy-aware-code.png' | relative_url }}" alt="Onchain data code output" loading="lazy"><div><h3>Onchain data</h3><p>Open source code for collection and preprocessing of the public dataset.</p><span class="card-link">View code <span aria-hidden="true">↗</span></span></div></a>
    <a class="resource-card" href="https://github.com/QuantLet/Network_Centrality" target="_blank" rel="noreferrer"><img src="{{ '/assets/code-previews/network-centrality-code.png' | relative_url }}" alt="Network centrality code output" loading="lazy"><div><h3>Network centrality</h3><p>Reproducible code for graph centrality usage examples.</p><p class="companion">Companion code to Graph Centrality Measures.</p><span class="card-link">View code <span aria-hidden="true">↗</span></span></div></a>
    <a class="resource-card" href="https://github.com/QuantLet/Hierarchical-Loan-Forecasting" target="_blank" rel="noreferrer"><img src="{{ '/assets/code-previews/hierarchical-loans-code.png' | relative_url }}" alt="Hierarchical Loan Forecasting code output" loading="lazy"><div><h3>Hierarchical Loan Forecasting</h3><p>Code for hierarchical loan forecasting using a public dataset of Italian loan originations.</p><p class="companion">Companion code to Hierarchical Loan Forecasting.</p><span class="card-link">View code <span aria-hidden="true">↗</span></span></div></a>
    <a class="resource-card" href="https://github.com/QuantLet/Proper-Scoring-Rules" target="_blank" rel="noreferrer"><img src="{{ '/assets/code-previews/proper-scoring-rules-code.png' | relative_url }}" alt="Proper Scoring Rules code output" loading="lazy"><div><h3>Proper Scoring Rules</h3><p>Code for reproducing the examples in the talk on proper scoring rules.</p><p class="companion">Companion code to Proper Scoring Rules.</p><span class="card-link">View code <span aria-hidden="true">↗</span></span></div></a>
    <a class="resource-card" href="https://github.com/QuantLet/LLMs-for-BTC-TS/tree/main/2.%20Fractional%20differencing" target="_blank" rel="noreferrer"><img src="{{ '/assets/code-previews/LLM-for-BTC-code.png' | relative_url }}" alt="LLMs for BTC forecasting code output" loading="lazy"><div><h3>LLMs for BTC forecasting</h3><p>Code for reproducing figures from the published paper.</p><span class="card-link">View code <span aria-hidden="true">↗</span></span><span class="secondary-link">Published paper <span aria-hidden="true">↗</span></span></div></a>
  </div>
</section>

<section class="portfolio-section plain-section" id="data" aria-labelledby="data-title">
  <div class="section-heading"><h2 id="data-title">Open data</h2></div>
  <div class="resource-grid data-grid">
    <a class="resource-card" href="https://zenodo.org/records/22037835" target="_blank" rel="noreferrer"><img src="{{ '/assets/talk-previews/placeholder.svg' | relative_url }}" alt="Placeholder for Zenodo dataset preview" loading="lazy"><div><h3>Stablecoin DeFi Hourly Dataset</h3><p>Open research data.</p><span class="card-link">View dataset <span aria-hidden="true">↗</span></span></div></a>
    <a class="resource-card" href="https://zenodo.org/records/20120190" target="_blank" rel="noreferrer"><img src="{{ '/assets/talk-previews/placeholder.svg' | relative_url }}" alt="Placeholder for Zenodo dataset preview" loading="lazy"><div><h3>Sarafu Network Public Dataset</h3><p>Open research data.</p><span class="card-link">View dataset <span aria-hidden="true">↗</span></span></div></a>
  </div>
</section>

<section class="contact-band" aria-label="Get in touch"><p>Interested in research, data, or a good forecasting problem?</p><div><a href="https://www.linkedin.com/in/{{ site.linkedin_username }}/" rel="me">LinkedIn <span aria-hidden="true">↗</span></a><a href="mailto:{{ site.email }}">{{ site.email }} <span aria-hidden="true">↗</span></a></div></section>

<script>
  (function () {
    fetch("{{ '/dashboard_data/rf_results.json' | relative_url }}?v=" + Date.now())
      .then(function (response) { if (!response.ok) throw new Error('Live data unavailable'); return response.json(); })
      .then(function (data) {
        if (data.calibrated !== true) {
          document.getElementById('home-risk-meta').textContent = 'Model recalibration pending';
          return;
        }
        var probability = Math.max(0, Math.min(1, Number(data.probability)));
        document.getElementById('home-risk-orb').style.setProperty('--risk', (probability * 360) + 'deg');
        document.getElementById('home-risk-value').textContent = (probability * 100).toFixed(1) + '%';
        document.getElementById('home-risk-meta').textContent = 'Calibrated ±' + (data.target_threshold_bps || 15) + ' bps risk · ' + (probability >= .55 ? 'elevated' : probability >= .25 ? 'moderate' : 'low');
      })
      .catch(function () { document.getElementById('home-risk-meta').textContent = 'Live data temporarily unavailable'; });
  }());
</script>
