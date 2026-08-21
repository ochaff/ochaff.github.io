---
layout: page
title: Writing archive
---

<div class="archive-page"><p class="eyebrow">All writing</p><h1>{{ page.title }}</h1><div class="archive-list">{% for post in site.posts %}<a class="archive-item" href="{{ post.url | relative_url }}"><span>{{ post.date | date: "%Y" }}</span><strong>{{ post.title }}</strong><span aria-hidden="true">→</span></a>{% endfor %}</div></div>
