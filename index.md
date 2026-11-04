---
layout: default
title: Owen Chaffard
home_monitor: true
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
  <a class="live-card ammonitor-card" href="{{ '/depeg-monitor-ida.html' | relative_url }}" data-monitor-src="{{ '/dashboard_data/rf_results.json' | relative_url }}" data-asset-base="{{ '/assets/ammonitor/' | relative_url }}">
    <div class="live-card-copy">
      <div class="home-monitor-brand"><img src="{{ '/assets/ammonitor/ammonitor-logo.png' | relative_url }}" width="54" height="44" alt=""><h2 id="monitor-title">AM<span>Monitor</span></h2></div>
      <p class="home-monitor-pair">USDC / USDT · Ethereum · Uniswap v3</p>
      <p>Follow depeg probability, liquidity conditions and 24-hour price forecasts in one monitor.</p>
      <span class="card-link">Open AMMonitor <span aria-hidden="true">↗</span></span>
    </div>
    <div class="home-monitor-snapshot" aria-label="Latest AMMonitor snapshot">
      <div class="home-monitor-top"><span>Depeg probability · next 24h</span><span class="home-monitor-band" id="home-risk-band">Awaiting data</span></div>
      <strong id="home-risk-value">—</strong>
      <p class="home-monitor-target">Any ±15 bps breach in the next 24 hours</p>
      <div class="home-monitor-token"><span>Token at risk</span><strong id="home-risk-token">—</strong></div>
      <p id="home-risk-meta" class="home-monitor-meta" aria-live="polite">Loading latest model output…</p>
    </div>
  </a>
</section>

<section class="portfolio-section" id="explorations" aria-labelledby="explorations-title">
  <div class="section-heading"><h2 id="explorations-title">Visual explorations</h2><a class="archive-link" href="{{ '/archive.html' | relative_url }}">All writings <span aria-hidden="true">→</span></a></div>
  <div class="exploration-series-grid">
    {% for series in site.data.blog_series %}
      {% assign series_posts = site.posts | where_exp: "post", "post.categories contains series.category" | sort: "date" %}
      {% if series_posts.size > 0 %}
      <section class="exploration-series" data-columns="{{ series.columns }}" aria-labelledby="series-{{ series.id }}">
        <div class="series-heading">
          <div class="series-heading-top"><h3 id="series-{{ series.id }}">{{ series.title | escape }}</h3><span class="series-heading-count">{{ series_posts.size }} {% if series_posts.size == 1 %}post{% else %}posts{% endif %}</span></div>
          <p>{{ series.description | escape }}</p>
        </div>
        <div class="explore-grid">
          {% for post in series_posts %}
            {% include blog-card.html post=post fallback_image=series.preview_image %}
          {% endfor %}
        </div>
      </section>
      {% endif %}
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

<script src="{{ '/assets/ammonitor/home-monitor.js' | relative_url }}" defer></script>
