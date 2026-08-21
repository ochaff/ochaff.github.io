---
layout: default
title: Owen Chaffard
---

<section class="hero" aria-labelledby="intro-title">
  <div class="hero-copy">
    <p class="eyebrow">Digital finance · time series</p>
    <h1 id="intro-title">Owen<br><em>Chaffard</em></h1>
    <p class="hero-intro">I explore how data, markets, and forecasting can make digital finance more intelligible.</p>
    <div class="hero-actions" aria-label="Profile links">
      <a class="button button-primary" href="https://github.com/{{ site.github_username }}" rel="me">GitHub <span aria-hidden="true">↗</span></a>
      <a class="button button-secondary" href="https://www.linkedin.com/in/{{ site.linkedin_username }}/" rel="me">LinkedIn <span aria-hidden="true">↗</span></a>
      <a class="text-link" href="{{ '/cv.pdf' | relative_url }}">Curriculum vitae <span aria-hidden="true">↓</span></a>
    </div>
  </div>
  <div class="hero-mark" aria-hidden="true">
    <span class="mark-dot mark-dot-one"></span><span class="mark-dot mark-dot-two"></span><span class="mark-dot mark-dot-three"></span>
    <svg viewBox="0 0 360 270" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 210C48 177 73 195 109 144C145 93 177 158 207 129C245 92 263 45 360 20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M0 245C55 211 85 231 128 184C168 140 194 181 233 156C276 128 305 97 360 89" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 7" opacity=".45"/></svg>
  </div>
</section>

<section class="work-section" id="writing" aria-labelledby="writing-title">
  <div class="section-heading"><div><p class="eyebrow">Selected writing</p><h2 id="writing-title">Research notes &amp; visual explorations</h2></div><a class="archive-link" href="{{ '/archive.html' | relative_url }}">View archive <span aria-hidden="true">→</span></a></div>
  <div class="post-list">
    {% for post in site.posts limit: 2 %}
      <article class="post-card"><p class="post-card-meta">{{ post.date | date: "%Y" }} <span aria-hidden="true">/</span> {{ post.categories | default: "Research note" | join: ", " }}</p><h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3><p>{{ post.description | default: post.excerpt | strip_html | strip_newlines | truncate: 145 }}</p><a class="card-link" href="{{ post.url | relative_url }}">Read article <span aria-hidden="true">→</span></a></article>
    {% endfor %}
  </div>
</section>

<section class="contact-band" aria-label="Get in touch"><p>Interested in research, data, or a good forecasting problem?</p><a href="mailto:{{ site.email }}">{{ site.email }} <span aria-hidden="true">↗</span></a></section>
