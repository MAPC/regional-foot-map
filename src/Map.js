import React, { useState, useEffect, useRef } from "react";

import { openDB } from "idb";

import styled from "styled-components";

import Spinner from "react-bootstrap/Spinner";
import Nav from "react-bootstrap/Nav";
import Form from "react-bootstrap/Form";
import Overlay from "react-bootstrap/Overlay";
import CloseButton from "react-bootstrap/CloseButton";

import arcgisPbfDecode from "arcgis-pbf-parser";

import MAPCLogo from "./assets/mapc-semitransparent.svg";
import { MapContainer, TileLayer, ZoomControl, GeoJSON, Circle, useMapEvents, ScaleControl, useMap } from "react-leaflet";

import "leaflet/dist/leaflet.css";
import "bootstrap/dist/css/bootstrap.min.css";

// Importing "for side effects", i.e., to extend leaflet with smooth scrolling
import "./SmoothScroll";
import { polygon } from "leaflet";
import { FeatureLayer } from "react-esri-leaflet";

import Airtable from "airtable";

// constants
const MAP_DB = "MapCache";
const AGOL_ORG_HASH = "c5WwApDsDjRhIVkH";
const GEOMETRY_STORE = "geometries";
const zoomLevels = {
  country: 4,
  state: 8.5,
  region: 10,
  municipality: 11,
  censusTract: 15,
  parcel: 18,
};
const stateMapProps = {
  center: [42.030590752172635, -71.82353838842278],
  zoom: zoomLevels.state,
  zoomDelta: 0.25,
  maxZoom: zoomLevels.parcel,
  minZoom: zoomLevels.country,
  zoomSnap: 0.25,
};

const regionMapProps = {
  center: [42.3457, -71.17852],
  zoom: zoomLevels.region,
  zoomDelta: 0.25,
  maxZoom: zoomLevels.parcel,
  minZoom: zoomLevels.country,
  zoomSnap: 0.25,
};

const Legend = styled.div`
  border-radius: 5px;
  position: absolute;
  width: 22.5%;
  height: 40%;
  background-color: rgba(255, 255, 255, 1);
  top: 0.8rem;
  right: 0.8rem;
  z-index: 1000;
  display: grid;
  grid-template-columns: 2fr;
  padding: 1%;
  overflow-y: scroll;
  overflow-x: hidden;
  text-overflow: ellipsis;
  border-style: solid;
  border-color: rgba(175, 175, 175, 1);
  border-width: 2px;
`;

const LegendElement = styled.div`
  display: flex;
  flex-direction: row;

  &:hover {
    color: ${(props) => (props.selectable ? "#387d3c" : "")};
  }
  cursor: ${(props) => (props.selectable ? "pointer" : "auto")};
`;

const LegendWrapper = styled.div`
  margin-top: 1rem;
  height: calc(100% - 4rem);
`;

const LegendText = styled.div`
  margin-left: 1rem;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  position: relative;

  /* top: -1px; */
`;

const LegendTextGray = styled.div`
  margin-left: 1rem;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  position: relative;
  /* top: -1px; */
  color: #888888;
  &:hover {
    color: #888888;
  }
`;

const LegendTextStrong = styled.div`
  margin-left: 1rem;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-weight: bold;
  position: relative;
  top: -2px;
`;

const Container = styled.div`
  display: flex;
  flex-direction: row;
`;

const RightSidebar = styled.div`
  display: flex;
  flex-direction: column;
  width: 25%;
  height: 100vh;
  background-color: white;
  border-style: solid;
  border-color: rgba(175, 175, 175, 1);
  border-width: 0 0 0 2px;
`;

const SidebarTop = styled.div`
  height: 65%;
  border-style: solid;
  border-color: rgba(225, 225, 225, 1);
  border-width: 0 0 2px 0;
  padding: 0.5rem 1rem 1.5rem 1.5rem;
  overflow-y: scroll;
`;
const SidebarBottom = styled.div`
  background-color: rgba(250, 250, 250, 1);
  height: 35%;
  padding: 1rem 1.5rem;
  color: rgba(175, 175, 175, 1);
  display: flex;
  justify-content: center;
  align-items: center;
  user-select: none;
  overflow-y: scroll;
`;

const SidebarBottomList = styled.div`
  width: 100%;
  height: 100%;
  padding: 1rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: start;
  color: #0b1618;
`;

const SidebarBottomTitle = styled.div`
  width: 100%;

  font-weight: bold;
  font-size: 1rem;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const SidebarBottomLine = styled.div`
  width: 100%;
  color: #0b1618;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const SidebarBottomLeft = styled.div`
  float: left;
  color: rgba(200, 200, 200, 1);
`;

const SidebarBottomRight = styled.div`
  float: right;
`;

const SideBarTitle = styled.h4`
  margin-bottom: 0.25rem;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: end;
  background-color: #78be20;
  color: #f2f5ff;
  padding: 0.7rem 0.7rem;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  height: 100vh;
  width: 100%;
  background-color: rgba(200, 200, 200, 0.5);
  z-index: 798;
`;

const LoadingContainer = styled.div`
  position: absolute;
  top: calc(50% - 75px);
  right: calc(50% - 32.5px);
  height: 75px;
  width: 75px;
  /* background-color: white; */
  display: flex;
  align-items: center;
  justify-content: center;
  /* border: 2px solid rgba(0, 0, 0, 0.2); */
`;

const LoadingIndicator = styled(Spinner)``;

const Wrapper = styled.div`
  flex: 1;
  height: 100%;
  div.leaflet-container {
    height: ${(props) => props.height};
  }
`;

const StyledSwitch = styled(Form.Check)`
  position: absolute;
  z-index: 999;
  background-color: white;

  border-style: solid;
  border-width: 2px;
  border-color: rgba(100, 100, 100, 0.5);
  border-radius: 5px;

  padding: 0.5rem 1rem 0.5rem 2.75rem;
  right: 2rem;

  cursor: pointer;
  width: 13rem;
`;

const StyledBasemapButton = styled.div`
  position: absolute;
  z-index: 999;

  background-color: white;
  border-style: solid;
  border-width: 2px;
  border-color: rgba(100, 100, 100, 0.5);
  border-radius: 5px;

  padding: 0.75rem 0.75rem;
  top: 10rem;
  right: 1rem;
  cursor: pointer;
`;

const BasemapOverlay = styled.div`
  z-index: 9999;

  background-color: white;
  border-style: solid;
  border-width: 2px;
  border-color: rgba(100, 100, 100, 0.5);
  border-radius: 5px;

  padding: 0.75rem 0.75rem;
  margin-right: 0.5rem;
`;

const BasemapRadios = styled(Form.Check)`
  z-index: 999;
`;

const CloseSection = styled.div`
  position: absolute;
  padding: 0.5rem 0.75rem;
  background-color: #78be20;
  color: #f2f5ff;
  justify-content: center;
  align-items: center;
  display: flex;

  border-style: solid;
  border-radius: 5px;

  right: 2rem;
  cursor: pointer;
`;

// UTILS
export const createTileURL = (style = "light-v10", token = process.env.MAPBOX_TOKEN) => {
  const params = new URLSearchParams();
  params.set("access_token", token || "");
  const stylePath = `styles/v1/mapbox/${style}/tiles/{z}/{x}/{y}/`;
  return `${mapboxBaseURL}${stylePath}?${params}`;
};

export const authenticateEsriFromEnv = async () => {
  const clientId = process.env.REACT_APP_AGOL_CLIENT_ID;
  const clientSecret = process.env.REACT_APP_AGOL_CLIENT_SECRET;
  const expiration = 3600;
  if (clientId == null || clientSecret == null) {
    console.error("Unable to authenticate with ArcGIS Online: no credentials provided");
    return null;
  }
  return await authenticateEsri(clientId, clientSecret, expiration);
};
export const authenticateEsri = async (clientId, clientSecret, expiration = 3600) => {
  const authservice = "https://www.arcgis.com/sharing/rest/oauth2/token";
  const url = `${authservice}?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials&expiration=${expiration}`;
  let token;
  try {
    const response = await fetch(url, {
      method: "POST",
    });
    const responseJSON = await response.json();
    token = responseJSON.access_token;
  } catch (error) {
    console.error("Unable to authenticate with ArcGIS Online:");
    console.error(error);
  }
  return token;
};
const readFeatureCollection = async (cacheKey) => {
  const mapDB = await openDB(MAP_DB, 2, {
    upgrade(db, oldVersion, newVersion, transaction, event) {
      // Geometries are stored as GeoJSON FeatureCollection with a "name" property at the root level
      // The "name" corresponds to the layer name in AGOL
      const objectStore = db.createObjectStore(GEOMETRY_STORE, { keyPath: "name" });
      objectStore.createIndex("name", "name", { unique: true });
    },
    blocked(currentVersion, blockedVersion, event) {
      // TODO?
    },
    blocking(currentVersion, blockedVersion, event) {
      // TODO?
    },
    terminated() {
      // TODO?
    },
  });
  const store = mapDB.transaction(GEOMETRY_STORE).objectStore(GEOMETRY_STORE);
  const polygons = await store.get(cacheKey);
  return polygons;
};
const writeFeatureCollection = async (featureCollection) => {
  const mapDB = await openDB(MAP_DB, 2, {
    upgrade(db, oldVersion, newVersion, transaction, event) {
      // Geometries are stored as GeoJSON FeatureCollection with a "name" property at the root level
      // The "name" corresponds to the layer name in AGOL
      const objectStore = db.createObjectStore(GEOMETRY_STORE, { keyPath: "name" });
      objectStore.createIndex("name", "name", { unique: true });
    },
    blocked(currentVersion, blockedVersion, event) {
      // TODO
    },
    blocking(currentVersion, blockedVersion, event) {
      // TODO
    },
    terminated() {
      // TODO
    },
  });
  const store = mapDB.transaction(GEOMETRY_STORE, "readwrite").objectStore(GEOMETRY_STORE);
  await store.put(featureCollection);
};
export const getAGOLLayerURL = (serviceName, layerID = null) => {
  // TODO: separate layer from service
  // TODO: gracefully handle no matching layer name
  return `https://services.arcgis.com/${AGOL_ORG_HASH}/arcgis/rest/services/${serviceName}/FeatureServer/${layerID}`;
};
export const getCacheKey = (serviceName, layerKey) => {
  return `${serviceName}-${layerKey}`;
};

export const queryFeatureService = async ({ serviceName, token = null, layerID = null, layerName = null, count = null, force = false }) => {
  const layerKey = layerName ? layerName : layerID;
  const cacheKey = getCacheKey(serviceName, layerKey);
  let featureCollection = await readFeatureCollection(cacheKey);
  if (!force && featureCollection != null) {
    // Return cached version if we have it
    return featureCollection;
  }
  if (token == null) {
    token = await authenticateEsriFromEnv();
  }
  if (layerID == null) {
    const layerResponse = await fetch(
      `https://services.arcgis.com/${AGOL_ORG_HASH}/ArcGIS/rest/services/${serviceName}/FeatureServer/layers?f=pjson&token=${token}`
    );
    const { layers } = await layerResponse.json();
    if (layers.length === 1 && layerName == null) {
      // If number of layers is 1, use that by default if no layerName is provided
      layerID = layers[0].id;
      layerName = layers[0].name;
    } else if (layerName != null) {
      // Otherwise, try to match layerName in list of available layers
      layerID = layers.filter((l) => l.name == serviceName)[0];
    }
  }
  // Only fetch new data from server if read from IndexedDB is not successful
  featureCollection = {
    type: "FeatureCollection",
    name: cacheKey,
    crs: { type: "name", properties: { name: "EPSG:4326" } },
    features: [],
  };
  const layerURL = getAGOLLayerURL(serviceName, layerID);
  if (count == null) {
    const idURL = `${layerURL}/query?where=0=0&returnGeometry=false&f=pjson&token=${token}&returnIdsOnly=true`;
    const idsResponse = await fetch(idURL);
    // TODO: See if there's a way to do this with pbf
    const idsJSON = await idsResponse.json();
    const ids = idsJSON.objectIds;
    count = ids.length;
  }
  const url = `${layerURL}/query?returnGeometry=true&outSR=4326&outFields=muni_id&f=pbf&token=${token}`;
  let featuresList = [];
  // TODO: Figure out better way to do chunk sizing that takes API limits into account (likely just institute a cap/max)
  const chunkSize = Math.min(Math.ceil(count / 3), 10000);
  const chunks = [...Array(Math.ceil(count / chunkSize)).keys()].map((n) => n * chunkSize);
  const parts = await Promise.all(
    chunks.map((c) =>
      fetch(`${url}&where=ObjectId>${c} and ObjectId<=${c + chunkSize}`, {
        cache: "force-cache",
      })
    )
  );
  const buffers = await Promise.all(parts.map((part) => part.arrayBuffer()));
  featuresList = buffers.map((buff) => arcgisPbfDecode(new Uint8Array(buff)).featureCollection);
  featureCollection.features = featuresList.reduce((acc, v, i) => {
    return acc.concat(v.features);
  }, []);
  writeFeatureCollection(featureCollection);
  return featureCollection;
};

const MapEventsHandler = ({ setZoom }) => {
  const map = useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
    },
  });
  return null;
};

function setSimplifyFactor(zoom) {
  if (zoom >= 10) {
    return 0.5;
  } else if (zoom >= 5) {
    return 0.25;
  }

  return 0;
}

// Hook to handle map events

const LegendImages = [
  {
    src: (
      <svg width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        <line x1="0" y1="15" x2="30" y2="15" stroke="black" stroke-width="5" />
      </svg>
    ),
    label: "Existing Greenway",
    disabled: true,
  },
  {
    src: (
      <svg width="30" height="30" xmlns="http://www.w3.org/2000/svg">
        <line x1="0" y1="15" x2="30" y2="15" stroke="black" stroke-width="5" strokeDasharray="6, 5" />
      </svg>
    ),
    label: "Envisioned Greenway",
    disabled: true,
  },
  {
    src: <svg width="30" height="30" xmlns="http://www.w3.org/2000/svg"></svg>,
    label: " ",
    disabled: true,
  },
];

// map overlay to relevant basemap URLs
const basemaps = {
  "Topo - ESRI (Default)": {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community",
  },
  // "Stadia.AlidadeSmooth": {
  //   url: "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png",
  //   attribution:
  //     '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  // },
  // "Topo - USGS": {
  //   url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}",
  //   attribution: 'Tiles courtesy of the <a href="https://usgs.gov/">U.S. Geological Survey</a>',
  // },
  "Topo - USGS": {
    url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}",
    attribution: 'Tiles courtesy of the <a href="https://usgs.gov/">U.S. Geological Survey</a>',
  },
  // "CartoDB Voyager": {
  //   url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png",
  //   attribution:
  //     '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  // },
  Light: {
    url: `https://tile.jawg.io/jawg-light/{z}/{x}/{y}{r}.png?access-token=${process.env.REACT_APP_JAWG_TOKEN}`,
    attribution: "",
  },
  "Imagery - ESRI": {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
  },
};

const CreateCustomPanes = () => {
  const map = useMap();

  useEffect(() => {
    map.createPane("mainPane");
    map.getPane("mainPane").style.zIndex = 500;
  }, [map]);

  return null;
};

export const MAPCMap = ({ wrapperHeight = "100vh", mapFocus = "region", polyPoints = [], mapboxToken = process.env.REACT_APP_MAPBOX_TOKEN }) => {
  const [polygons, setPolygons] = useState([]);
  const [selectedFeature, setSelectedFeature] = useState();
  const [selectedType, setSelectedType] = useState();
  const [selectedTrail, setSelectedTrail] = useState();

  const [trailDetails, setTrailDetails] = useState([]);

  const [zoom, setZoom] = useState(10);

  const target = useRef(null);
  const [showBaseMaps, setShowBaseMaps] = useState(false);
  const [selectedBasemap, setSelectedBasemap] = useState("Topo - ESRI (Default)");

  const [showExisting, setShowExisting] = useState(true);
  const [showDesignConstruction, setShowDesignConstruction] = useState(true);
  const [showEnvisioned, setShowEnvisioned] = useState(true);
  const [featureQuery, setFeatureQuery] = useState("1=1");
  const [showPolygons, setShowPolygons] = useState(true);

  const [isLoading, setIsLoading] = useState(true);

  const pathWeight = 4.5 * (10.0 / zoom);

  useEffect(() => {
    // AIRTABLE CMS
    var base = new Airtable({ apiKey: process.env.REACT_APP_AIRTABLE_TOKEN }).base("appuLlZwmGGeG3m9k");

    let tempProjectObject = {};
    base("Regional Foot Trails")
      .select({
        // Selecting the first 3 records in Grid view:
        view: "Grid view",
      })
      .eachPage(
        function page(records, fetchNextPage) {
          // This function (`page`) will get called for each page of records.

          records.forEach(function (record) {
            if (record != null && record.get("Status") == "Published") {
              tempProjectObject[record.get("Name")] = {
                Description: record.get("Description"),
                Link: record.get("Link"),
                Color: record.get("Color"),
                disabled: record.get("Disabled"),
              };

              LegendImages.push({
                src: (
                  <svg width="30" height="30" xmlns="http://www.w3.org/2000/svg">
                    <line x1="0" y1="15" x2="30" y2="15" stroke={record.get("Disabled") ? "#666666" : record.get("Color")} stroke-width="5" />
                  </svg>
                ),
                label: record.get("Name"),
                disabled: record.get("Disabled"),
              });
            }
          });

          // To fetch the next page of records, call `fetchNextPage`.
          // If there are more records, `page` will get called again.
          // If there are no more records, `done` will get called.
          fetchNextPage();
        },
        function done(err) {
          if (err) {
            console.error(err);
            return;
          }
          setTrailDetails(tempProjectObject);
        }
      );
  }, []);

  let focusProps = regionMapProps; // Default: MAPC regional map
  if (mapFocus === "state") {
    focusProps = stateMapProps;
  }

  let layers = [];
  // TODO: provide options for indicating "blocking" vs "non-blocking" layers
  if (isLoading) {
    layers = [
      <LoadingOverlay>
        <LoadingContainer>
          <LoadingIndicator animation="border" role="status">
            <span style={{ display: "none" }}>Loading...</span>
          </LoadingIndicator>
        </LoadingContainer>
      </LoadingOverlay>,
    ];
  }

  useEffect(() => {
    const loadPolygons = async () => {
      // constants and feature query setup
      const clientId = process.env.REACT_APP_AGOL_CLIENT_ID;
      const clientSecret = process.env.REACT_APP_AGOL_CLIENT_SECRET;
      const token = await authenticateEsri(clientId, clientSecret);
      const serviceName = "simplified_muni_polygons_2";
      const polygonData = await queryFeatureService({ token, serviceName, force: true });
      setPolygons([
        {
          id: "muni-polygons",
          styleFunction: () => {
            return {
              fillColor: "#69bbf6",
              color: "#666666",
              weight: 1.25,
              fillOpacity: 0.0,
              opacity: 0.6,
              zIndex: -1000,
            };
          },
          data: polygonData.features,
        },
      ]);
    };
    if (showPolygons) {
      loadPolygons();
    }
  }, []);

  if (polygons.length > 0 && showPolygons) {
    for (let polyConfig of polygons) {
      // TODO: Set up default polygon colors in constants
      layers.push(<GeoJSON id={polyConfig.id} key={polyConfig.id} data={polyConfig.data} interactive={false} style={polyConfig.styleFunction} />);
    }
  }

  function handleFeatureClick(feature) {
    if (feature.layer.feature.properties) {
      setSelectedFeature(feature.layer.feature.properties);

      let splitString = feature.layer.feature.properties.reg_name ? feature.layer.feature.properties.reg_name.split(",") : null;
      if (splitString && splitString.length > 0) {
        let trimmedArray = splitString.map((item) => item.trim());

        setSelectedTrail(trimmedArray);
      } else {
        setSelectedTrail(feature.layer.feature.properties.reg_name ? feature.layer.feature.properties.reg_name : null);
      }
    }
  }

  useEffect(() => {
    function mapType() {
      if (selectedFeature == undefined) {
        return;
      }
      let type = "";
      if (selectedFeature.seg_type == 1 && selectedFeature.fac_stat == 1) {
        type = "Shared Use Path - Existing";
      }
      if (selectedFeature.seg_type == 1 && selectedFeature.fac_stat == 2) {
        type = "Shared Use Path - Designed";
      }
      if (selectedFeature.seg_type == 1 && selectedFeature.fac_stat == 3) {
        type = "Shared Use Path - Envisioned";
      }
      if (selectedFeature.seg_type == 6) {
        type = "Shared Use Path - Unimproved Surface";
      }
      if (selectedFeature.seg_type == 2 && selectedFeature.fac_stat == 1) {
        type = "Protected Bike Lane and Sidewalk";
      }
      if (selectedFeature.seg_type == 2 && (selectedFeature.fac_stat == 2 || selectedFeature.fac_stat == 3)) {
        type = "Protected Bike Lane - Design or Construction";
      }
      if (selectedFeature.seg_type == 3 && selectedFeature.fac_stat == 1) {
        type = "Bike Lane and Sidewalk";
      }
      if (selectedFeature.seg_type == 3 && (selectedFeature.fac_stat == 2 || selectedFeature.fac_stat == 3)) {
        type = "Bike Lane - Design or Construction";
      }
      if (selectedFeature.seg_type == 4 && (selectedFeature.fac_stat == 3 || selectedFeature.fac_stat == 1)) {
        type = "Shared Street - Urban";
      }
      if (selectedFeature.seg_type == 5 && selectedFeature.fac_stat == 1) {
        type = "Shared Street - Suburban";
      }
      if (selectedFeature.seg_type == 5 && selectedFeature.fac_stat == 3) {
        type = "Shared Street - Envisioned";
      }
      if (selectedFeature.seg_type == 9) {
        type = "Gap - Facility Type TBD";
      }
      if (selectedFeature.seg_type == 11 && selectedFeature.fac_stat == 1) {
        type = "Foot Trail - Existing";
      }
      if (selectedFeature.seg_type == 11 && (selectedFeature.fac_stat == 2 || selectedFeature.fac_stat == 3)) {
        type = "Foot Trail - Envisioned";
      }
      if (selectedFeature.seg_type == 12 && selectedFeature.fac_stat == 1) {
        type = "Foot Trail - Existing";
      }
      if (selectedFeature.seg_type == 12 && (selectedFeature.fac_stat == 2 || selectedFeature.fac_stat == 3)) {
        type = "Foot-Trail - Envisioned";
      }

      setSelectedType(type);
    }

    mapType();
  }, [selectedFeature]);

  useEffect(() => {
    const generateQuery = () => {
      const query = [];

      if (showExisting) {
        query.push("fac_stat = 1");
      }
      if (showEnvisioned) {
        query.push("fac_stat = 2");
        query.push("fac_stat = 3");
      }

      if (query.length > 0) {
        return "(" + query.join(" OR ") + ") AND (seg_type = 11 OR seg_type = 12)";
      }
      return "0=1";
    };

    setFeatureQuery(generateQuery);
  }, [showEnvisioned, showDesignConstruction, showExisting]);

  return (
    <Container>
      <Wrapper height={wrapperHeight}>
        <MapContainer
          {...focusProps}
          zoomControl={false}
          preferCanvas={false}
          scrollWheelZoom={true}
          smoothWheelZoom={true} // enable smooth zoom
          smoothSensitivity={2.5} // zoom speed. default is 1
        >
          <CreateCustomPanes />
          <Form style={{ position: "absolute", width: "100%", left: "1rem", top: "1rem" }}>
            <StyledSwitch
              checked={showExisting}
              onChange={() => {
                setShowExisting(!showExisting);
              }}
              type="switch"
              id="custom-switch"
              label="Existing Greenways"
              style={{ top: "0rem" }}
            />
            <StyledSwitch
              checked={showEnvisioned}
              onChange={() => {
                setShowEnvisioned(!showEnvisioned);
              }}
              type="switch"
              id="custom-switch"
              label="Envisioned"
              style={{ top: "3rem" }}
            />
            <StyledSwitch
              checked={showPolygons}
              onChange={() => {
                setShowPolygons(!showPolygons);
              }}
              type="switch"
              id="custom-switch"
              label="Municipal Boundaries"
              style={{ top: "6rem" }}
            />
          </Form>
          <StyledBasemapButton
            ref={target}
            onClick={() => {
              setShowBaseMaps(!showBaseMaps);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="bi bi-map" viewBox="0 0 16 16">
              <path
                fillRule="evenodd"
                d="M15.817.113A.5.5 0 0 1 16 .5v14a.5.5 0 0 1-.402.49l-5 1a.5.5 0 0 1-.196 0L5.5 15.01l-4.902.98A.5.5 0 0 1 0 15.5v-14a.5.5 0 0 1 .402-.49l5-1a.5.5 0 0 1 .196 0L10.5.99l4.902-.98a.5.5 0 0 1 .415.103M10 1.91l-4-.8v12.98l4 .8zm1 12.98 4-.8V1.11l-4 .8zm-6-.8V1.11l-4 .8v12.98z"
              />
            </svg>
          </StyledBasemapButton>

          <Overlay target={target.current} show={showBaseMaps} placement="left-start">
            {({
              placement: _placement,
              arrowProps: _arrowProps,
              show: _show,
              popper: _popper,
              hasDoneInitialMeasure: _hasDoneInitialMeasure,
              ...props
            }) => (
              <BasemapOverlay
                {...props}
                style={{
                  ...props.style,
                }}
              >
                <Form>
                  {Object.keys(basemaps).map((basemap) => {
                    return (
                      <BasemapRadios
                        checked={basemap == selectedBasemap}
                        onChange={() => {
                          setSelectedBasemap(basemap);
                        }}
                        type="radio"
                        id="custom-radio"
                        label={basemap}
                      />
                    );
                  })}
                </Form>
              </BasemapOverlay>
            )}
          </Overlay>

          <TileLayer
            key={selectedBasemap}
            url={basemaps[selectedBasemap].url}
            attribution={basemaps[selectedBasemap].attribution}
            tileSize={512}
            zoomOffset={-1}
          />

          <ZoomControl position="bottomright" />
          <ScaleControl position="bottomright" />
          {/* <Legend>
          {LegendImages.map((legend) => {
            return (
              <LegendElement>
                <img src={legend.src} style={{ width: 30, height: 30 }} />
                <LegendText>{legend.label}</LegendText>
              </LegendElement>
            );
          })}
        </Legend> */}
          <MapEventsHandler setZoom={setZoom} />
          <FeatureLayer
            url="https://geo.mapc.org/server/rest/services/transportation/landlines/FeatureServer/0"
            key={featureQuery} //FORCE RELOAD ON QUERY CHANGE
            simplifyFactor={setSimplifyFactor(zoom)}
            eventHandlers={{
              click: handleFeatureClick,
              loading: () => setIsLoading(true),
              load: () => setIsLoading(false),
            }}
            where={featureQuery}
            style={(feature) => {
              let colorRow = trailDetails && trailDetails["Other"] ? trailDetails["Other"].Color : null;
              let dashArray;

              if (feature.properties.fac_stat == 3 || feature.properties.fac_stat == 2) {
                dashArray = "3,8";
              }

              if (feature.properties.reg_name && trailDetails && Object.keys(trailDetails).includes(feature.properties.reg_name)) {
                colorRow = trailDetails[feature.properties.reg_name].Color;
              }

              let splitString = feature.properties.reg_name ? feature.properties.reg_name.split(",") : null;
              if (splitString && splitString.length > 1) {
                let trimmedArray = splitString.map((item) => item.trim());

                if (trailDetails && trimmedArray.some((item) => Object.keys(trailDetails).includes(item))) {
                  trimmedArray.forEach((trailName) => {
                    if (Object.keys(trailDetails).includes(trailName)) {
                      colorRow = trailDetails[trailName].Color;
                    }
                  });

                  return {
                    color: colorRow,
                    stroke: colorRow,
                    weight: pathWeight,
                    fillOpacity: 0,
                    opacity: !selectedTrail || trimmedArray.some((item) => selectedTrail.includes(item)) ? 1 : 0.25,
                    dashArray: dashArray,
                    dashOffset: "0",
                  };
                }
              }

              return {
                color: colorRow,
                stroke: colorRow,
                weight: pathWeight,
                fillOpacity: 0,
                opacity: !selectedTrail || selectedTrail.includes(feature.properties.reg_name ? feature.properties.reg_name : null) ? 1 : 0.25,
                dashArray: dashArray,
                dashOffset: "0",
              };
            }}
            pane="mainPane"
          />
          {layers}
        </MapContainer>
      </Wrapper>
      <RightSidebar>
        <SideBarTitle>
          <a href="https://www.mapc.org/transportation/landline/" style={{ position: "relative", color: "inherit", textDecoration: "none" }}>
            <img alt="MAPC logo" src={MAPCLogo} style={{ marginRight: "0.5rem", width: 90, height: "auto" }} />
            <span style={{ position: "relative", bottom: "-16px", fontSize: "20px" }}>Regional Foot Trails</span>
          </a>
        </SideBarTitle>
        <SidebarTop>
          {/* <Nav justify variant="tabs" defaultActiveKey="landlines" onSelect={handleSelectTab}>
            <Nav.Item>
              <Nav.Link eventKey="landlines">Landlines</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="projects">Greenway Projects</Nav.Link>
            </Nav.Item>
          </Nav> */}
          <LegendWrapper>
            {
              <>
                {LegendImages.map((legend) => {
                  return (
                    <LegendElement
                      onClick={() => {
                        if (!legend.disabled) {
                          setSelectedTrail(legend.label);
                          setSelectedFeature();
                        }
                      }}
                      selectable
                    >
                      {legend.src}
                      {legend.label ? (
                        selectedTrail && selectedTrail.includes(legend.label) ? (
                          <LegendTextStrong>{legend.label}</LegendTextStrong>
                        ) : legend.disabled ? (
                          <LegendTextGray>{legend.label}</LegendTextGray>
                        ) : (
                          <LegendText>{legend.label}</LegendText>
                        )
                      ) : (
                        <LegendTextGray>{"N/A"}</LegendTextGray>
                      )}
                    </LegendElement>
                  );
                })}
              </>
            }
          </LegendWrapper>
          <CloseSection
            onClick={() => {
              setSelectedFeature();
              setSelectedTrail();
              setSelectedTrail();
            }}
          >
            <CloseButton variant="white" style={{ marginRight: "0.25rem" }} />
            Clear
          </CloseSection>
        </SidebarTop>
        <SidebarBottom>
          {selectedFeature !== undefined || selectedTrail !== undefined ? (
            <SidebarBottomList>
              <SidebarBottomTitle>Foot Trail</SidebarBottomTitle>
              <SidebarBottomLine>
                <SidebarBottomLeft>Name:</SidebarBottomLeft>
                <SidebarBottomRight>{selectedFeature ? selectedFeature.reg_name : selectedTrail}</SidebarBottomRight>
              </SidebarBottomLine>
              <SidebarBottomLine>
                <SidebarBottomLeft>Type:</SidebarBottomLeft>
                <SidebarBottomRight>{selectedType || "N/A"}</SidebarBottomRight>
              </SidebarBottomLine>
              <SidebarBottomLine>
                <SidebarBottomLeft>Description:</SidebarBottomLeft>
                <SidebarBottomRight>{trailDetails[selectedTrail] ? trailDetails[selectedTrail].Description : "N/A"}</SidebarBottomRight>
              </SidebarBottomLine>
            </SidebarBottomList>
          ) : (
            "Select a trail"
          )}
        </SidebarBottom>
      </RightSidebar>
    </Container>
  );
};

export default MAPCMap;
