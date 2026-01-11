window.HadoopSimReady = import('./index.js').then((HadoopSim) => {
  window.HadoopSim = HadoopSim;
  return HadoopSim;
});
