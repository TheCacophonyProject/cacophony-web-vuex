<template>
  <l-map
    class="map"
    :style="{
      height: mapHeight,
      pointerEvents: isInteractive ? 'auto' : 'none',
    }"
    :bounds="mapBounds"
    :options="{ zoomControl: zoom, dragging: isInteractive }"
    @ready="onReady"
  >
    <l-control-layers v-if="canChangeBaseMap && mapLayers.length > 1" />
    <l-w-m-s-tile-layer
      v-for="layer in mapLayers"
      :key="layer.name"
      :base-url="layer.url"
      :layers="layer.layers"
      :visible="layer.visible"
      :name="layer.name"
      :attribution="layer.attribution"
      layer-type="base"
    />
    <l-circle
      v-for="point in mapLocationsForRadius"
      :lat-lng="point.location"
      :radius="60"
      :key="`r_${point.name}`"
      :fill-opacity="0.25"
      :weight="1"
      :stroke="false"
      :interative="false"
    />
    <l-circle-marker
      v-for="point in mapLocations"
      :lat-lng="point.location"
      :key="point.name"
      :radius="5"
      color="black"
      :weight="0.5"
      :fill-opacity="1"
      @click="(e) => navigateToLocation(point)"
    >
      <l-tooltip
        >{{ point.name }}: {{ Number(point.location.lat).toFixed(5) }},
        {{ Number(point.location.lng).toFixed(5) }}</l-tooltip
      >
    </l-circle-marker>
  </l-map>
</template>

<script lang="ts">
import { linzBasemapApiKey } from "@/config";
import { latLng, LatLng, latLngBounds } from "leaflet";
import {
  LCircle,
  LCircleMarker,
  LMap,
  LTooltip,
  LWMSTileLayer,
  LControlLayers,
} from "vue2-leaflet";

interface Point {
  name: string;
  location: LatLng;
}

export default {
  name: "MapWithPoints",
  components: {
    LMap,
    LTooltip,
    LCircle,
    LCircleMarker,
    LWMSTileLayer,
    LControlLayers,
  },
  props: {
    points: {
      type: Array,
      required: true,
    },
    radius: {
      type: Number,
      default: 0,
    },
    height: {
      type: Number,
      default: 400,
    },
    zoom: {
      type: Boolean,
      default: true,
    },
    canChangeBaseMap: {
      type: Boolean,
      default: true,
    },
    isInteractive: {
      type: Boolean,
      default: true,
    },
    navigateToPoint: {
      type: Function,
      required: false,
    },
  },
  computed: {
    mapLayers() {
      const OpenStreetMapFallbackLayer = {
        name: "OpenStreetMap Basemap",
        visible: false,
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution:
          '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
      };
      if (linzBasemapApiKey && linzBasemapApiKey !== "YOUR_API_KEY_HERE") {
        return [
          {
            name: "LINZ Basemap",
            visible: true, // Make the LINZ basemap the default one
            attribution:
              '<a href="//www.linz.govt.nz/data/linz-data/linz-basemaps/data-attribution">LINZ CC BY 4.0 © Imagery Basemap contributors</a>',
            url: `https://basemaps.linz.govt.nz/v1/tiles/aerial/3857/{z}/{x}/{y}.webp?api=${linzBasemapApiKey}`,
          },
          {
            name: "LINZ Topo",
            visible: false, // Make the LINZ basemap the default one
            attribution:
              '<a href="//www.linz.govt.nz/data/linz-data/linz-basemaps/data-attribution">LINZ CC BY 4.0 © Imagery Basemap contributors</a>',
            url: `http://tiles-a.data-cdn.linz.govt.nz/services;key=${linzBasemapApiKey}/tiles/v4/layer=767/EPSG:3857/{z}/{x}/{y}.png`,
          },
          OpenStreetMapFallbackLayer,
        ];
      }
      return [{ ...OpenStreetMapFallbackLayer, visible: true }];
    },
    mapBounds() {
      // Calculate the initial map bounds and zoom level from the set of lat/lng points
      return latLngBounds([
        this.mapLocations.map(({ location }) => location),
      ]).pad(0.25);
    },
    mapLocations(): Point[] {
      return this.points.map(({ location, ...rest }) => ({
        location:
          typeof location === "string"
            ? latLng(
                location.split(", ").map(Number) as [number, number, number]
              )
            : location,
        ...rest,
      }));
    },
    mapLocationsForRadius(): Point[] {
      if (this.radius !== 0) {
        return this.mapLocations;
      }
      return [];
    },
    mapHeight(): string {
      return `${this.height}px`;
    },
  },
  methods: {
    navigateToLocation(point: Point) {
      if (this.navigateToPoint) {
        this.$router.push(this.navigateToPoint(point));
      }
    },
    onReady(e) {
      // Stupid hack to get the map to render in the correct position on load.
      e._onResize();
    },
  },
};
</script>

<style scoped lang="scss"></style>
