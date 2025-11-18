## Unveiling The Structure of Hierarchcical Time Series
---

## Hierarchical Time Series 

Real forecasting tasks typically involve a large number of time series. Think of the relevant time series to electricity generation in the US: total generated per state/region, per fuel source, per ultimate customer (industrial or residential). All of these series are related: the state-level generation adds up to the regional generation, which should add up to the national total. This structured collection of time series, connected by aggregation rules, is what we call **Hierarchical Time Series**.

Hierarchical time series appear everywhere: finance (portfolio → sector → asset), retail (company → region → store → product), energy (country → region → substation), and operations (organization → department → team). The hierarchy encodes how finer-grained series roll up into higher-level summaries, and that structure is both a constraint and an opportunity for better forecasting.


![](https://ochaff.github.io/figures/combined_ITC.png)
## Visualization of 3d trajectories 

Multivariate time series define unique trajectories in phase space. Looking at phase space can help unveil structure in the dynamics of the studied signal. 


### Lorenz Attractor

### Time series
![](https://ochaff.github.io/figures/anim_full.gif)

### Trajectory
![](https://ochaff.github.io/figures/anim_lorenz.gif)

---

## 3D random walk

<iframe src="https://ochaff.github.io/figures/3d_random_walk.html"
        width="100%" height="700" frameborder="0"></iframe>

---
## Structured trajectory

<iframe src="https://ochaff.github.io/figures/structured_walk.html"
        width="100%" height="700" frameborder="0"></iframe>

---
## Hierarchical time series

<iframe src="https://ochaff.github.io/figures/hierarchical_ts.html"
        width="100%" height="700" frameborder="0"></iframe>

---
## Hierarchical time series reconciliation
<iframe src="https://ochaff.github.io/figures/forecast_reconciliation.html"
        width="100%" height="700" frameborder="0"></iframe>