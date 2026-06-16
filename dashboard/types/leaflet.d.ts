declare module 'leaflet.heat' {
  import * as L from 'leaflet';
  function heatLayer(
    latlngs: [number, number, number?][],
    options?: {
      minOpacity?: number;
      maxZoom?: number;
      radius?: number;
      blur?: number;
      max?: number;
      gradient?: Record<string, string>;
    }
  ): L.Layer;
  export default heatLayer;
}
