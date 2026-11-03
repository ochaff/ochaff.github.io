/* Shared presentation for the three phase-space figures in the HTS introduction. */
window.renderPhasePlot = function (id, data, layout) {
  const plot = document.getElementById(id);
  if (!window.Plotly) {
    plot.className = "plot-error";
    plot.textContent = "The interactive plot could not load. Please check your connection and reload.";
    return;
  }

  const comparison = data.some(trace => trace.type === "surface");
  const compact = window.matchMedia("(max-width: 540px)");
  const paper = "#f4f7fc";
  const ink = "#10203a";
  const muted = "#62708a";
  const blue = "#2568d8";
  const red = "#e64d62";

  // Keep every coordinate; only change presentation.
  data.forEach(trace => {
    if (trace.type === "surface") {
      trace.colorscale = [[0, "#b8ccec"], [1, "#b8ccec"]];
      trace.opacity = 0.22;
      trace.name = "Coherent plane";
      trace.hoverinfo = "skip";
      return;
    }
    if (!comparison) {
      trace.line.colorscale = [[0, "#b4ccef"], [0.45, blue], [1, "#173b77"]];
      trace.line.width = 4;
      return;
    }
    const styles = {
      "raw ARIMA": [red, "Base forecast"],
      "bottom-up": ["#24836b", "Bottom-Up"],
      "projection": ["#bd7624", "GTOP projection"],
      "True vals": [blue, "Observed"]
    };
    const style = styles[trace.name];
    if (style) {
      trace.name = style[1];
      trace.line.color = style[0];
      if (trace.marker) trace.marker.color = style[0];
    } else if (trace.showlegend === false) {
      trace.line.color = "#bd7624";
    }
  });

  layout.autosize = true;
  layout.paper_bgcolor = paper;
  layout.plot_bgcolor = paper;
  layout.font = { family: '"DM Sans", system-ui, sans-serif', size: 12, color: ink };
  layout.margin = { l: 8, r: 8, t: 36, b: 8 };
  layout.hoverlabel = { bgcolor: paper, bordercolor: "#d6e0ee", font: { color: ink } };
  layout.modebar = { bgcolor: paper, color: muted, activecolor: blue };
  layout.scene.bgcolor = paper;
  layout.scene.dragmode = "orbit";
  layout.uirevision = "phase-space";
  if (!comparison && layout.scene.camera?.eye) {
    // Leave room for tick labels in the shorter embedded canvas.
    const eye = layout.scene.camera.eye;
    layout.scene.camera.eye = { x: eye.x * 1.22, y: eye.y * 1.22, z: eye.z * 1.22 };
  }

  ["xaxis", "yaxis", "zaxis"].forEach((key, index) => {
    Object.assign(layout.scene[key], {
      title: { text: ["x", "y", "z"][index], font: { size: 14, color: ink } },
      showbackground: false,
      showgrid: !comparison,
      gridcolor: "#d6e0ee",
      gridwidth: 1,
      linecolor: "#aabbd3",
      zeroline: false,
      tickfont: { size: 11, color: muted },
      nticks: 5,
      showspikes: false
    });
  });

  function responsiveLayout() {
    return {
      "scene.domain.y": [comparison ? (compact.matches ? 0.2 : 0.12) : 0, 1],
      legend: {
        orientation: "h", x: 0.5, xanchor: "center", y: 0, yanchor: "bottom",
        bgcolor: "rgba(0,0,0,0)", font: { size: compact.matches ? 11 : 12 },
        itemsizing: "constant", traceorder: "normal"
      }
    };
  }

  // The scene and legend share the canvas without covering each other.
  const responsive = responsiveLayout();
  layout.scene.domain = { x: [0, 1], y: responsive["scene.domain.y"] };
  layout.legend = responsive.legend;
  Plotly.newPlot(plot, data, layout, {
    responsive: true,
    displaylogo: false,
    displayModeBar: true,
    scrollZoom: false,
    modeBarButtons: [["orbitRotation", "pan3d", "zoom3d", "resetCameraDefault3d"]]
  }).then(() => {
    compact.addEventListener("change", () => Plotly.relayout(plot, responsiveLayout()));
  }).catch(() => {
    plot.className = "plot-error";
    plot.textContent = "The 3D plot could not be displayed. Please try a browser with WebGL enabled.";
  });
};
