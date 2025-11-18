## Unveiling The Structure of Hierarchcical Time Series
---

## Hierarchical Time Series 

Real forecasting tasks typically involve a large number of time series. Think of the relevant time series to electricity generation in the US: total generated per state/region, per fuel source, per ultimate customer (industrial or residential). All of these series are related: the state-level generation adds up to the regional generation, which should add up to the national total. This structured collection of time series, connected by aggregation rules, is what we call **Hierarchical Time Series**.

Hierarchical time series appear everywhere: finance (portfolio → sector → asset), retail (company → region → store → product), energy (country → region → substation), and operations (organization → department → team). The hierarchy encodes how finer-grained series roll up into higher-level summaries, and that structure is both a **constraint** and an **opportunity** for better forecasting.

![](https://ochaff.github.io/figures/combined_ITC.png)
<div style="text-align: center;font-style:italic">
Truncated hierarchy of Italian regions highlighting the North West macro-region and its children regions (Vallee d'Aoste,Piemonte,Liguria,Lombardia) 
</div>

In order to define mathematically a hierarchical system we need to notice that all time series in the hierarchy are defined as sums of some the bottom level series (most disaggregated).

Thus given $\mathbf{y}_t \in \mathbb{R}^n$ the vector of all time series and $\mathbf{b}_t \in \mathbb{R}^m$ the vector of bottom time series (note $m<n$). The hierarchy is fully defined by the summing matrix $S$ s.t. 



$$
\begin{align}
\mathbf{y}_t = S \mathbf{b}_t \;\;\;\;\;\;\;\;\;\;\;\;\;\;\;\;\;\;\; \|\mathbf{y}_t - S\mathbf{b}_t\| = \mathrm{C}_t = 0
\end{align}
$$

**Note** : Forecasts are not always coherent ($\mathrm{C}_t \neq 0$). $\mathrm{C}_t$ measures the incoherence or the distance from the hierarchical structure for each possible set of values


$$
\underbrace{
\begin{bmatrix}
\mathrm{IT}_t \\[2pt]
\color{red}{\mathrm{ITC}_t} \\[2pt]
\mathrm{ITF}_t \\[2pt]
\mathrm{ITG}_t \\[2pt]
\mathrm{ITH}_t \\[2pt]
\mathrm{ITI}_t \\[4pt]
\color{salmon}{\mathrm{ITC1}_t} \\[2pt]
\color{coral}{\mathrm{ITC2}_t} \\[2pt]
\color{crimson}{\mathrm{ITC3}_t} \\[2pt]
\color{maroon}{\mathrm{ITC4}_t} \\[2pt]
\vdots
\end{bmatrix}
}_{\mathbf{y}_t}
=
\underbrace{
\begin{bmatrix}
1 & 1 & 1 & 1 & 1 & \cdots & 1 & \cdots \\[4pt]
\color{red}{1} & \color{red}{1} & \color{red}{1} & \color{red}{1} & 0 & \cdots & 0 & \cdots \\[4pt]
0 & 0 & 0 & 0 & 1 & \cdots & 1 & \cdots \\[4pt]
0 & 0 & 0 & 0 & 0 & \cdots & 0 & \cdots \\[4pt]
0 & 0 & 0 & 0 & 0 & \cdots & 0 & \cdots \\[4pt]
0 & 0 & 0 & 0 & 0 & \cdots & 0 & \cdots \\[4pt]
\hline
\color{salmon}{1} & 0 & 0 & 0 & 0 & \cdots & 0 & \cdots \\[2pt]
0 & \color{coral}{1} & 0 & 0 & 0 & \cdots & 0 & \cdots \\[2pt]
0 & 0 & \color{crimson}{1} & 0 & 0 & \cdots & 0 & \cdots \\[2pt]
0 & 0 & 0 & \color{maroon}{1} & 0 & \cdots & 0 & \cdots \\[2pt]
0 & 0 & 0 & 0 & 1 & \cdots & 0 & \cdots \\[2pt]
\vdots & \vdots & \vdots & \vdots & \vdots & \ddots & \vdots & \\[2pt]
0 & 0 & 0 & 0 & 0 & \cdots & 1 & \cdots
\end{bmatrix}
}_{\mathbf{S}}
\underbrace{
\begin{bmatrix}
\color{salmon}{\mathrm{ITC1}_t} \\[2pt]
\color{coral}{\mathrm{ITC2}_t} \\[2pt]
\color{crimson}{\mathrm{ITC3}_t} \\[2pt]
\color{maroon}{\mathrm{ITC4}_t} \\[2pt]
\vdots
\end{bmatrix}
}_{\mathbf{b}_t}
$$


<div style="text-align: center;font-style:italic;margin-bottom:20px">
Example summing matrix for the Italian region hierarchy. In red are highlighted the time series related to north west macro-region. Note that the bottom part is the identity matrix, while the top parts dictates which bottom time series are each aggregate's children.
</div>


One of the core issues in hierarchical time series forecasting is that forecasts are **not coherent by default**. This mathematical formulation of what coherence means also gives a natural way to reconcile incoherent forecasts. Indeed since a coherent hierarchy is fully defined by its bottom level components we simply need to map our incoherent forecasts $\hat{\mathbf{y}}_t$ to the bottom level $\hat{\mathbf{b}}_t = G\hat{\mathbf{y}}_t$. Thus we recover coherent forecasts : 

$$
\begin{align}
\tilde{\mathbf{y}}_t = S\hat{\mathbf{b}}_t = SG \hat{\mathbf{y}}_t
\end{align}
$$

**Note** : $G$ is an $m\times n$ matrix which essentially dictates which forecasts will be used in the reconstruction of the bottom series and describes the reconciliation method. The simplest method one can conceive is the **Bottom-Up** method where only the bottom level forecasts are used ($G$ corresponds to the identity matrix on the bottom levels).

While this formalism is useful in practice when forecasting hierarchical time series. I will propose a geometric definition of incoherence, which visually explains forecast reconciliation using **phase space**.  


## Introduction to Phase Space 

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