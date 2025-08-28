// 基础配置和变量
const AUTO_ENABLE = true;
const LONDON_BOUNDS = { minLng: -0.5, maxLng: 0.5, minLat: 51.2, maxLat: 51.8 };

const LAYER_FILES = {
  boundary: '../local-nav/local-nav/park-data/park-data/park_boundary.geojson',
  trails: '../local-nav/local-nav/park-data/park-data/trails.geojson',
  vegetation: '../local-nav/local-nav/park-data/park-data/vegetation.geojson',
  water: '../local-nav/local-nav/park-data/park-data/water.geojson',
  facilities: '../local-nav/local-nav/park-data/park-data/facilities_toilet_drink_bench.geojson',
  poi: '../local-nav/local-nav/park-data/park-data/poi_all.geojson'
};

// 全局变量
let map;
let currentDrawer = null;
let pickMode = null;
let startLatLng = null, endLatLng = null;
let startMarker = null, endMarker = null, routeLine = null;
let layers = {};
let trailGraph = null;
let originalPoiData = null;

// 初始化地图
function initMap() {
  map = L.map('map').setView([51.5045, -0.1300], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  
  // 地图点击事件
  map.on('click', function(e) {
    if (pickMode === 'start') {
      setStartPoint([e.latlng.lat, e.latlng.lng]);
    } else if (pickMode === 'end') {
      setEndPoint([e.latlng.lat, e.latlng.lng]);
    } else {
      // 收回底部抽屉
      document.querySelectorAll('.bottom-drawer.open').forEach(drawer => {
        drawer.classList.remove('open');
      });
    }
  });
  
  // 自动加载数据和天气
  autoLoadData();
  loadWeather();
}

// 基础功能函数
function isInLondon(lng, lat) {
  return lng >= LONDON_BOUNDS.minLng && lng <= LONDON_BOUNDS.maxLng && 
         lat >= LONDON_BOUNDS.minLat && lat <= LONDON_BOUNDS.maxLat;
}

function filterGeoJSONFeatures(geojson) {
  if (!geojson || !geojson.features) return geojson;
  
  const filtered = { ...geojson, features: [] };
  geojson.features.forEach(feature => {
    let coords = null;
    if (feature.geometry.type === 'Point') {
      coords = feature.geometry.coordinates;
    } else if (feature.geometry.type === 'Polygon' && feature.geometry.coordinates[0]) {
      coords = feature.geometry.coordinates[0][0];
    } else if (feature.geometry.type === 'LineString' && feature.geometry.coordinates[0]) {
      coords = feature.geometry.coordinates[0];
    }
    
    if (coords && isInLondon(coords[0], coords[1])) {
      filtered.features.push(feature);
    }
  });
  
  return filtered;
}

function getLayerStyle(key) {
  const styles = {
    boundary: { color: '#dc2626', weight: 3, fillOpacity: 0.1 },
    trails: { color: '#059669', weight: 2, opacity: 0.8 },
    vegetation: { color: '#16a34a', fillOpacity: 0.3, weight: 1 },
    water: { color: '#0ea5e9', fillOpacity: 0.6, weight: 1 },
    facilities: { color: '#7c3aed', fillOpacity: 0.7, radius: 6 }
  };
  return styles[key] || { color: '#64748b', weight: 2 };
}

function createLayerFromGeoJSON(key, geojson) {
  const style = getLayerStyle(key);
  
  return L.geoJSON(geojson, {
    style: feature => style,
    pointToLayer: (feature, latlng) => {
      if (key === 'poi') {
        return L.circleMarker(latlng, {
          radius: 4, fillColor: '#f59e0b', color: '#fff', weight: 1,
          fillOpacity: 0.8, opacity: 1
        });
      }
      return L.circleMarker(latlng, { ...style, radius: style.radius || 5 });
    },
    onEachFeature: (feature, layer) => {
      const props = feature.properties || {};
      const name = props.name || props.Name || 'Unnamed';
      
      layer.on('click', (e) => {
        if (pickMode) {
          e.originalEvent.stopPropagation();
          return;
        }
        
        if (key === 'poi') {
          const amenity = props.amenity || '';
          const tourism = props.tourism || '';
          layer.bindPopup(`<strong>${name}</strong><br>Type: ${amenity || tourism || 'Other'}`).openPopup();
        } else {
          layer.bindPopup(`<strong>${name}</strong>`).openPopup();
        }
      });
    }
  });
}

// 自动加载数据
async function autoLoadData() {
  showToast('Auto-loading data...', 'info');
  document.getElementById('dataStatus').textContent = 'Loading...';
  
  setupLayerList();
  
  try {
    await Promise.all(Object.entries(LAYER_FILES).map(([k, f]) => loadLayer(k, f)));
    
    document.getElementById('dataStatus').textContent = '已加载 6/6 图层';
    showToast('Data loading completed', 'success');
    
    // 自动加载POI数据
    setTimeout(() => {
      reloadPOI();
    }, 1000);
  } catch (e) {
    document.getElementById('dataStatus').textContent = 'Loading failed';
    showToast('Data loading failed', 'error');
  }
}

function setupLayerList() {
  const layerList = document.getElementById('layerList');
  const layerNames = {
    boundary: '🏞 公园边界',
    trails: '🛤 步道网络', 
    vegetation: '🌿 植被区域',
    water: '💧 水体特征',
    facilities: '🏢 公园设施',
    poi: '📍 兴趣点位'
  };
  
  Object.keys(LAYER_FILES).forEach(key => {
    const item = document.createElement('div');
    item.className = 'layer-item';
    item.setAttribute('data-layer', key);
    item.innerHTML = `
      <div class="icon">${layerNames[key].split(' ')[0]}</div>
      <div class="info">
        <div class="name">${layerNames[key].split(' ')[1]}</div>
        <div class="status">等待加载</div>
      </div>
    `;
    
    item.onclick = function() {
      this.classList.toggle('active');
      const layer = layers[key];
      if (layer) {
        if (this.classList.contains('active')) {
          layer.addTo(map);
        } else {
          map.removeLayer(layer);
        }
      }
      showToast(`图层${this.classList.contains('active') ? '已开启' : '已关闭'}`, 'info');
    };
    
    layerList.appendChild(item);
  });
}

async function loadLayer(key, filename) {
  const layerItem = document.querySelector(`[data-layer="${key}"]`);
  if (layerItem) {
    layerItem.querySelector('.status').textContent = '加载中...';
  }
  
  try {
    const response = await fetch(filename);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    let data = await response.json();
    
    if (key !== 'poi') {
      data = filterGeoJSONFeatures(data);
    }
    
    const layer = createLayerFromGeoJSON(key, data);
    
    if (layers[key]) {
      map.removeLayer(layers[key]);
    }
    
    layers[key] = layer;
    layer.addTo(map);
    
    if (key === 'boundary') {
      try {
        map.fitBounds(layer.getBounds(), { padding: [20, 20] });
      } catch (e) {
        console.warn(`调整视图失败:`, e);
      }
    }
    
    if (key === 'trails') {
      window.trailFeatures = data.features;
      trailGraph = buildTrailGraph(data.features);
    }
    
    if (layerItem) {
      layerItem.classList.add('active');
      layerItem.querySelector('.status').textContent = '已加载';
    }
    
  } catch (e) {
    console.error(`[${key.toUpperCase()}] 加载失败:`, e);
    if (layerItem) {
      layerItem.querySelector('.status').textContent = '加载失败';
    }
  }
}

// 路径规划功能
function buildTrailGraph(trailFeatures) {
  const graph = { nodes: new Map(), edges: [] };
  let nodeId = 0;
  
  trailFeatures.forEach(feature => {
    if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates;
      const nodes = [];
      
      coords.forEach(coord => {
        const latlng = [coord[1], coord[0]];
        const id = `node_${nodeId++}`;
        
        const node = {
          id: id,
          latlng: latlng,
          adj: new Map()
        };
        
        graph.nodes.set(id, node);
        nodes.push(node);
      });
      
      for (let i = 0; i < nodes.length - 1; i++) {
        const nodeA = nodes[i];
        const nodeB = nodes[i + 1];
        const distance = haversine(nodeA.latlng, nodeB.latlng);
        
        nodeA.adj.set(nodeB.id, distance);
        nodeB.adj.set(nodeA.id, distance);
        
        graph.edges.push({
          from: nodeA.id,
          to: nodeB.id,
          weight: distance
        });
      }
    }
  });
  
  console.log(`构建步道图: ${graph.nodes.size} 个节点, ${graph.edges.length} 条边`);
  return graph;
}

function haversine(p1, p2) {
  const R = 6371000;
  const lat1 = p1[0] * Math.PI / 180, lng1 = p1[1] * Math.PI / 180;
  const lat2 = p2[0] * Math.PI / 180, lng2 = p2[1] * Math.PI / 180;
  const dlat = lat2 - lat1, dlng = lng2 - lng1;
  const A = Math.sin(dlat/2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlng/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(A), Math.sqrt(1-A));
}

function findNearestNode(latlng) {
  if (!trailGraph || trailGraph.nodes.size === 0) return null;
  
  let nearest = null;
  let minDist = Infinity;
  
  for (const node of trailGraph.nodes.values()) {
    const dist = haversine(latlng, node.latlng);
    if (dist < minDist) {
      minDist = dist;
      nearest = node;
    }
  }
  
  return nearest;
}

function dijkstra(startId, endId) {
  if (!trailGraph) return null;
  
  const distances = new Map();
  const previous = new Map();
  const unvisited = new Set();
  
  for (const nodeId of trailGraph.nodes.keys()) {
    distances.set(nodeId, Infinity);
    unvisited.add(nodeId);
  }
  distances.set(startId, 0);
  
  while (unvisited.size > 0) {
    let current = null;
    let minDist = Infinity;
    
    for (const nodeId of unvisited) {
      if (distances.get(nodeId) < minDist) {
        minDist = distances.get(nodeId);
        current = nodeId;
      }
    }
    
    if (!current || minDist === Infinity) break;
    
    unvisited.delete(current);
    
    if (current === endId) break;
    
    const currentNode = trailGraph.nodes.get(current);
    for (const [neighborId, weight] of currentNode.adj) {
      if (unvisited.has(neighborId)) {
        const alt = distances.get(current) + weight;
        if (alt < distances.get(neighborId)) {
          distances.set(neighborId, alt);
          previous.set(neighborId, current);
        }
      }
    }
  }
  
  const path = [];
  let current = endId;
  while (current) {
    path.unshift(current);
    current = previous.get(current);
  }
  
  return path.length > 1 ? path : null;
}

// 路径规划相关函数
function setStartPoint(latlng) {
  startLatLng = latlng;
  
  if (startMarker) map.removeLayer(startMarker);
  startMarker = L.marker(latlng, {
    icon: L.divIcon({
      html: '🟢',
      className: 'emoji-marker',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    })
  }).addTo(map);
  
  pickMode = 'end';
  showPickHint('请在地图上点击选择终点');
  showToast('起点已设置，请选择终点', 'success');
}

function setEndPoint(latlng) {
  endLatLng = latlng;
  
  if (endMarker) map.removeLayer(endMarker);
  endMarker = L.marker(latlng, {
    icon: L.divIcon({
      html: '🔴',
      className: 'emoji-marker',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    })
  }).addTo(map);
  
  pickMode = null;
  hidePickHint();
  showToast('终点已设置，正在规划路径...', 'info');
  
  // 自动规划路径
  setTimeout(() => {
    planRoute();
  }, 500);
}

function planRoute() {
  if (!startLatLng || !endLatLng) {
    showToast('请先设置起点和终点', 'warning');
    return;
  }
  
  // 清除旧路径
  if (routeLine) map.removeLayer(routeLine);
  
  // 使用步道网络规划路径
  if (trailGraph && trailGraph.nodes.size > 0) {
    const startNode = findNearestNode(startLatLng);
    const endNode = findNearestNode(endLatLng);
    
    if (startNode && endNode) {
      const path = dijkstra(startNode.id, endNode.id);
      
      if (path && path.length > 1) {
        const routeCoords = path.map(nodeId => trailGraph.nodes.get(nodeId).latlng);
        
        routeLine = L.polyline(routeCoords, {
          color: '#0ea5e9',
          weight: 4,
          opacity: 0.8
        }).addTo(map);
        
        const distance = calculateRouteDistance(routeCoords);
        const time = Math.round(distance / 1.4); // 1.4 m/s 步行速度
        
        showRouteInfo(distance, time);
        showToast('路径规划完成', 'success');
        
        // 打开路径推荐抽屉
        setTimeout(() => {
          openDrawer('routeDrawer');
          updateRouteRecommendations(distance, time);
        }, 1000);
        
        return;
      }
    }
  }
  
  // 直线路径作为备选
  const directCoords = [startLatLng, endLatLng];
  routeLine = L.polyline(directCoords, {
    color: '#ef4444',
    weight: 4,
    opacity: 0.8,
    dashArray: '10, 10'
  }).addTo(map);
  
  const distance = haversine(startLatLng, endLatLng);
  const time = Math.round(distance / 1.4);
  
  showRouteInfo(distance, time);
  showToast('已生成直线路径', 'warning');
  
  setTimeout(() => {
    openDrawer('routeDrawer');
    updateRouteRecommendations(distance, time);
  }, 1000);
}

function calculateRouteDistance(coords) {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += haversine(coords[i], coords[i + 1]);
  }
  return total;
}

function showRouteInfo(distance, time) {
  document.getElementById('routeDistance').textContent = `${(distance / 1000).toFixed(1)}km`;
  document.getElementById('routeTime').textContent = `${Math.round(time / 60)}分钟`;
  document.getElementById('routeInfoDisplay').classList.add('show');
}

function hideRouteInfo() {
  document.getElementById('routeInfoDisplay').classList.remove('show');
}

function updateRouteRecommendations(baseDistance, baseTime) {
  const routeDrawer = document.getElementById('routeDrawer');
  if (!routeDrawer) return;
  
  const recommendations = `
    <div class="route-recommendations">
      <div class="route-option selected">
        <div class="route-option-header">
          <div class="route-option-name">🌸 风景路线</div>
          <div class="route-option-time">${Math.round(baseTime * 1.2 / 60)}分钟</div>
        </div>
        <div class="route-option-features">经过主要景点和花园，适合观光游览</div>
      </div>
      
      <div class="route-option">
        <div class="route-option-header">
          <div class="route-option-name">⚡ 直达路线</div>
          <div class="route-option-time">${Math.round(baseTime * 0.8 / 60)}分钟</div>
        </div>
        <div class="route-option-features">最短路径，快速到达目的地</div>
      </div>
      
      <div class="route-option">
        <div class="route-option-header">
          <div class="route-option-name">🏃 健身路线</div>
          <div class="route-option-time">${Math.round(baseTime * 1.5 / 60)}分钟</div>
        </div>
        <div class="route-option-features">经过健身设施和运动区域</div>
      </div>
    </div>
  `;
  
  const content = routeDrawer.querySelector('.drawer-content');
  if (content) {
    content.innerHTML = recommendations;
    
    // 添加路线选择事件
    content.querySelectorAll('.route-option').forEach(option => {
      option.onclick = function() {
        content.querySelectorAll('.route-option').forEach(o => o.classList.remove('selected'));
        this.classList.add('selected');
        showToast('路线已选择', 'success');
      };
    });
  }
}

// 天气功能
async function loadWeather() {
  try {
    // 模拟天气数据
    const weather = {
      temperature: Math.round(15 + Math.random() * 10),
      condition: ['晴朗', '多云', '小雨'][Math.floor(Math.random() * 3)],
      humidity: Math.round(40 + Math.random() * 40),
      wind: Math.round(5 + Math.random() * 15)
    };
    
    const weatherText = `${weather.condition} ${weather.temperature}°C，湿度${weather.humidity}%，风速${weather.wind}km/h`;
    document.getElementById('weatherInfo').textContent = `天气：${weatherText}`;
    
  } catch (e) {
    document.getElementById('weatherInfo').textContent = '天气：获取失败';
  }
}

// POI功能 - 完整的地理过滤和类型筛选
function getFilterBounds(filterType) {
  // 使用POI数据的实际坐标范围（伦敦St James Park）
  // 基于调试输出：经度 -0.139695 ~ -0.129144, 纬度 51.500547 ~ 51.505680
  const parkBounds = {
    minLng: -0.140, maxLng: -0.129, 
    minLat: 51.500, maxLat: 51.506
  };
  
  switch (filterType) {
    case 'inside': 
      // 公园内 - 使用公园边界
      return parkBounds;
    case 'outside': 
      // 公园外 - 扩大范围但排除公园内
      return { 
        minLng: parkBounds.minLng - 0.05, maxLng: parkBounds.maxLng + 0.05,
        minLat: parkBounds.minLat - 0.02, maxLat: parkBounds.maxLat + 0.02,
        excludeInside: true
      };
    default: return null;
  }
}

function getSelectedPoiTypes() {
  const selectedTypes = {};
  document.querySelectorAll('.poi-item.active').forEach(item => {
    const type = item.getAttribute('data-type');
    selectedTypes[type] = true;
  });
  return selectedTypes;
}

function filterBySelectedTypes(features) {
  const selectedTypes = getSelectedPoiTypes();
  
  console.log('[POI] 选中的类型:', selectedTypes);
  
  // 如果选择了"all"，显示所有界面定义的POI类型
  if (selectedTypes.all) {
    console.log('[POI] 显示所有界面POI类型');
    return features.filter(feature => {
      const props = feature.properties || {};
      const name = (props.name || '').toLowerCase();
      const amenity = (props.amenity || '').toLowerCase();
      const tourism = (props.tourism || '').toLowerCase();
      
      // 匹配所有界面上定义的POI类型
      return (amenity.includes('toilet') || name.includes('toilet')) ||
             (amenity.includes('cafe') || amenity.includes('restaurant') || name.includes('cafe')) ||
             (name.includes('entrance') || name.includes('gate')) ||
             (tourism.includes('information') || name.includes('information')) ||
             (amenity.includes('playground') || name.includes('playground')) ||
             (amenity.includes('bench') || name.includes('bench')) ||
             (amenity.includes('drinking_water') || name.includes('water')) ||
             (amenity.includes('parking') || name.includes('parking')) ||
             (props.shop || amenity.includes('shop')) ||
             (props.leisure === 'garden' || name.includes('garden')) ||
             (props.natural === 'tree' || name.includes('tree')) ||
             (name.includes('duck') || name.includes('bird') || name.includes('animal')) ||
             (name.includes('lake') || name.includes('pond') || props.natural === 'water') ||
             (props.historic === 'memorial' || name.includes('memorial')) ||
             (props.man_made === 'bridge' || name.includes('bridge')) ||
             (tourism.includes('viewpoint') || name.includes('view')) ||
             (tourism.includes('artwork') || name.includes('art')) ||
             (tourism.includes('monument') || name.includes('statue'));
    });
  }
  
  // 如果选择了"none"，返回空数组
  if (selectedTypes.none) {
    console.log('[POI] 不显示任何POI');
    return [];
  }
  
  // 如果没有选择任何类型，默认显示基本设施
  if (Object.keys(selectedTypes).length === 0) {
    console.log('[POI] 没有选择，显示基本设施');
    return features.filter(feature => {
      const props = feature.properties || {};
      const name = (props.name || '').toLowerCase();
      const amenity = (props.amenity || '').toLowerCase();
      const tourism = (props.tourism || '').toLowerCase();
      
      // 基本设施：厕所、餐饮、入口、信息点、饮水点
      return (amenity.includes('toilet') || name.includes('toilet')) ||
             (amenity.includes('cafe') || amenity.includes('restaurant') || name.includes('cafe')) ||
             (name.includes('entrance') || name.includes('gate')) ||
             (tourism.includes('information') || name.includes('information')) ||
             (amenity.includes('drinking_water') || name.includes('water'));
    });
  }
  
  // 累加逻辑：显示所有选中的POI类型
  const filtered = features.filter(feature => {
    const props = feature.properties || {};
    const name = (props.name || '').toLowerCase();
    const amenity = (props.amenity || '').toLowerCase();
    const tourism = (props.tourism || '').toLowerCase();
    
    // 检查每个选中的POI类型，任何一个匹配就显示
    if (selectedTypes.toilets && (amenity.includes('toilet') || name.includes('toilet'))) return true;
    if (selectedTypes.restaurant && (amenity.includes('cafe') || amenity.includes('restaurant') || name.includes('cafe'))) return true;
    if (selectedTypes.entrance && (name.includes('entrance') || name.includes('gate'))) return true;
    if (selectedTypes.information && (tourism.includes('information') || name.includes('information'))) return true;
    if (selectedTypes.playground && (amenity.includes('playground') || name.includes('playground'))) return true;
    if (selectedTypes.bench && (amenity.includes('bench') || name.includes('bench'))) return true;
    if (selectedTypes.fountain && (amenity.includes('drinking_water') || name.includes('water'))) return true;
    if (selectedTypes.parking && (amenity.includes('parking') || name.includes('parking'))) return true;
    if (selectedTypes.shop && (props.shop || amenity.includes('shop'))) return true;
    if (selectedTypes.garden && (props.leisure === 'garden' || name.includes('garden'))) return true;
    if (selectedTypes.trees && (props.natural === 'tree' || name.includes('tree'))) return true;
    if (selectedTypes.wildlife && (name.includes('duck') || name.includes('bird') || name.includes('animal'))) return true;
    if (selectedTypes['water-feature'] && (name.includes('lake') || name.includes('pond') || props.natural === 'water')) return true;
    if (selectedTypes.memorial && (props.historic === 'memorial' || name.includes('memorial'))) return true;
    if (selectedTypes.bridge && (props.man_made === 'bridge' || name.includes('bridge'))) return true;
    if (selectedTypes.viewpoint && (tourism.includes('viewpoint') || name.includes('view'))) return true;
    if (selectedTypes.art && (tourism.includes('artwork') || name.includes('art'))) return true;
    if (selectedTypes.monument && (tourism.includes('monument') || name.includes('statue'))) return true;
    if (selectedTypes.other && !amenity && !tourism && !props.natural) return true;
    
    return false;
  });
  
  console.log(`[POI] 类型过滤结果: ${features.length} -> ${filtered.length}`);
  return filtered;
}

function getFeatureCoords(feature) {
  if (feature.geometry.type === 'Point') {
    return feature.geometry.coordinates;
  }
  return null;
}

function isInBounds(coords, bounds) {
  const [lng, lat] = coords;
  return lng >= bounds.minLng && lng <= bounds.maxLng && 
         lat >= bounds.minLat && lat <= bounds.maxLat;
}

function limitFeatures(features, maxCount) {
  if (features.length <= maxCount) return features;
  
  const sorted = features.sort((a, b) => {
    const aProps = a.properties || {};
    const bProps = b.properties || {};
    const aName = (aProps.name || '').toLowerCase();
    const bName = (bProps.name || '').toLowerCase();
    const aAmenity = (aProps.amenity || '').toLowerCase();
    const bAmenity = (bProps.amenity || '').toLowerCase();
    
    if (aAmenity.includes('toilet') && !bAmenity.includes('toilet')) return -1;
    if (!aAmenity.includes('toilet') && bAmenity.includes('toilet')) return 1;
    
    if (aName.includes('entrance') && !bName.includes('entrance')) return -1;
    if (!aName.includes('entrance') && bName.includes('entrance')) return 1;
    
    return 0;
  });
  
  return sorted.slice(0, maxCount);
}

async function reloadPOI() {
  const geoFilter = document.getElementById('poiGeoFilter')?.value || 'inside';
  const maxCount = parseInt(document.getElementById('poiLimit')?.value || '2000');
  
  console.log(`[POI] 重新加载，地理过滤: ${geoFilter}, 最大数量: ${maxCount}`);
  
  try {
    if (!originalPoiData) {
      const response = await fetch('../local-nav/local-nav/park-data/park-data/poi_all.geojson');
      originalPoiData = await response.json();
      
      // 调试：分析POI数据的实际坐标范围
      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
      let validCount = 0;
      originalPoiData.features.forEach(feature => {
        const coords = getFeatureCoords(feature);
        if (coords) {
          const [lng, lat] = coords;
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
          validCount++;
        }
      });
      console.log(`[POI] 数据坐标范围分析: 经度 ${minLng.toFixed(6)} ~ ${maxLng.toFixed(6)}, 纬度 ${minLat.toFixed(6)} ~ ${maxLat.toFixed(6)}, 有效坐标: ${validCount}`);
    }
    
    let features = originalPoiData.features;
    
    // 1. 先进行类型过滤 - 这样用户选择的POI类型不会被地理过滤影响
    const typeFilteredFeatures = filterBySelectedTypes(features);
    console.log(`[POI] 类型过滤: ${features.length} -> ${typeFilteredFeatures.length}`);
    
    // 2. 再进行地理位置过滤
    let finalFilteredFeatures = typeFilteredFeatures;
    const bounds = getFilterBounds(geoFilter);
    if (bounds) {
      console.log(`[POI] 使用地理边界:`, bounds);
      if (geoFilter === 'inside') {
        // 仅公园内
        finalFilteredFeatures = typeFilteredFeatures.filter(feature => {
          const coords = getFeatureCoords(feature);
          if (coords) {
            const inBounds = isInBounds(coords, bounds);
            if (!inBounds && typeFilteredFeatures.length < 5) {
              console.log(`[POI] 坐标 [${coords[0]}, ${coords[1]}] 不在边界内`);
            }
            return inBounds;
          }
          return false;
        });
      } else if (geoFilter === 'outside') {
        // 仅公园外 - 使用澳大利亚坐标
        const parkBounds = { minLng: 142.35, maxLng: 142.42, minLat: -38.12, maxLat: -38.08 };
        finalFilteredFeatures = typeFilteredFeatures.filter(feature => {
          const coords = getFeatureCoords(feature);
          return coords && !isInBounds(coords, parkBounds);
        });
      }
      console.log(`[POI] 地理过滤 ${geoFilter}: ${typeFilteredFeatures.length} -> ${finalFilteredFeatures.length}`);
    }
    
    // 3. 数量限制 - 使用用户选择的数量限制
    const finalFeatures = maxCount > 0 ? limitFeatures(finalFilteredFeatures, maxCount) : finalFilteredFeatures;
    
    // 4. 更新图层
    const finalData = { ...originalPoiData, features: finalFeatures };
    
    if (layers.poi) {
      map.removeLayer(layers.poi);
    }
    
    layers.poi = createLayerFromGeoJSON('poi', finalData);
    layers.poi.addTo(map);
    
    // 更新POI计数显示
    document.getElementById('poiCount').textContent = `${finalFeatures.length} 个POI点`;
    
    showToast(`POI重新加载完成: ${finalFeatures.length}个`, 'success');
    
  } catch (e) {
    console.error('[POI] 重新加载失败:', e);
    showToast('POI重新加载失败', 'error');
  }
}

function setupPoiControls() {
  // POI类型选择事件
  document.querySelectorAll('.poi-item').forEach(item => {
    item.onclick = function() {
      const type = this.getAttribute('data-type');
      
      if (type === 'all') {
        // 全选逻辑 - 只选择界面上实际显示的POI类型
        document.querySelectorAll('.poi-item').forEach(poi => {
          poi.classList.remove('active');
        });
        // 只选择界面上显示的具体POI类型，排除控制按钮
        const visibleTypes = ['restaurant', 'toilets', 'parking', 'entrance', 'shop', 'information', 
                             'bench', 'fountain', 'playground', 'viewpoint', 'monument', 'garden', 
                             'trees', 'wildlife', 'water-feature', 'memorial', 'bridge', 'art', 'other'];
        visibleTypes.forEach(visibleType => {
          const item = document.querySelector(`.poi-item[data-type="${visibleType}"]`);
          if (item) item.classList.add('active');
        });
        // 确保全选按钮本身保持激活状态
        this.classList.add('active');
      } else if (type === 'none') {
        // 全不选逻辑
        document.querySelectorAll('.poi-item').forEach(poi => {
          poi.classList.remove('active');
        });
      } else if (type === 'basic') {
        // 基本设施逻辑
        document.querySelectorAll('.poi-item').forEach(poi => {
          poi.classList.remove('active');
        });
        // 选中基本设施类型
        const basicTypes = ['restaurant', 'toilets', 'parking', 'entrance', 'shop', 'information', 'bench', 'fountain'];
        basicTypes.forEach(basicType => {
          const item = document.querySelector(`.poi-item[data-type="${basicType}"]`);
          if (item) item.classList.add('active');
        });
      } else {
        this.classList.toggle('active');
        
        // 检查是否需要更新"全部"状态
        const allItem = document.querySelector('.poi-item[data-type="all"]');
        const activeItems = document.querySelectorAll('.poi-item.active:not([data-type="all"])');
        const totalItems = document.querySelectorAll('.poi-item:not([data-type="all"])');
        
        if (activeItems.length === totalItems.length) {
          allItem.classList.add('active');
        } else {
          allItem.classList.remove('active');
        }
      }
      
      // 延迟重新加载POI，避免频繁触发
      clearTimeout(window.poiReloadTimeout);
      window.poiReloadTimeout = setTimeout(() => {
        console.log('[POI] POI类型选择已更改，重新加载');
        reloadPOI();
      }, 300);
    };
  });
  
  // 应用POI筛选按钮
  const applyBtn = document.querySelector('button[onclick*="reloadPOI"]');
  if (applyBtn) {
    applyBtn.onclick = function() {
      console.log('[POI] 手动应用POI筛选');
      reloadPOI();
      showToast('POI筛选已应用', 'success');
    };
  }
  
  // 快捷按钮事件
  document.getElementById('selectAllPoi')?.addEventListener('click', () => {
    // 先清除所有选择
    document.querySelectorAll('.poi-item').forEach(item => item.classList.remove('active'));
    // 只选择界面上显示的具体POI类型
    const visibleTypes = ['restaurant', 'toilets', 'parking', 'entrance', 'shop', 'information', 
                         'bench', 'fountain', 'playground', 'viewpoint', 'monument', 'garden', 
                         'trees', 'wildlife', 'water-feature', 'memorial', 'bridge', 'art', 'other'];
    visibleTypes.forEach(type => {
      const item = document.querySelector(`.poi-item[data-type="${type}"]`);
      if (item) item.classList.add('active');
    });
    // 激活"全选"按钮
    const allItem = document.querySelector('.poi-item[data-type="all"]');
    if (allItem) allItem.classList.add('active');
    
    clearTimeout(window.poiReloadTimeout);
    window.poiReloadTimeout = setTimeout(() => reloadPOI(), 100);
  });
  
  document.getElementById('selectNonePoi')?.addEventListener('click', () => {
    document.querySelectorAll('.poi-item').forEach(item => item.classList.remove('active'));
    clearTimeout(window.poiReloadTimeout);
    window.poiReloadTimeout = setTimeout(() => reloadPOI(), 100);
  });
  
  document.getElementById('selectEssentialPoi')?.addEventListener('click', () => {
    document.querySelectorAll('.poi-item').forEach(item => item.classList.remove('active'));
    ['toilets', 'entrance', 'information', 'fountain'].forEach(type => {
      const item = document.querySelector(`.poi-item[data-type="${type}"]`);
      if (item) item.classList.add('active');
    });
    clearTimeout(window.poiReloadTimeout);
    window.poiReloadTimeout = setTimeout(() => reloadPOI(), 100);
  });
}

// UI控制函数
function openDrawer(drawerId) {
  closeAllDrawers();
  
  const drawer = document.getElementById(drawerId);
  const overlay = document.getElementById('overlay');
  
  if (drawer) {
    drawer.classList.add('open');
    overlay.classList.add('show');
    currentDrawer = drawerId;
  }
}

function closeDrawer(drawerId) {
  const drawer = document.getElementById(drawerId);
  const overlay = document.getElementById('overlay');
  
  if (drawer) {
    drawer.classList.remove('open');
    overlay.classList.remove('show');
    currentDrawer = null;
  }
}

function closeAllDrawers() {
  document.querySelectorAll('.side-drawer, .bottom-drawer').forEach(drawer => {
    drawer.classList.remove('open');
  });
  document.getElementById('overlay').classList.remove('show');
  currentDrawer = null;
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast') || createToast();
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function createToast() {
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'toast';
  document.body.appendChild(toast);
  return toast;
}

function showPickHint(message) {
  const hint = document.getElementById('pickHint');
  if (hint) {
    hint.textContent = message;
    hint.style.display = 'block';
  } // 修复：添加闭合大括号
}

function hidePickHint() {
  const hint = document.getElementById('pickHint');
  if (hint) {
    hint.style.display = 'none';
  }
}

function autoLoadAll() {
  document.querySelectorAll('.layer-item').forEach(item => {
    if (!item.classList.contains('active')) {
      item.click();
    }
  });
  showToast('已开启所有图层', 'success');
}

// 事件监听
document.addEventListener('DOMContentLoaded', function() {
  initMap();
  
  // FAB按钮事件
  document.getElementById('menuFab').onclick = () => openDrawer('menuDrawer');
  document.getElementById('layersFab').onclick = () => openDrawer('layersDrawer');
  document.getElementById('poiFab').onclick = () => openDrawer('poiDrawer');
  document.getElementById('routeFab').onclick = () => openDrawer('routeDrawer');
  
  // 遮罩层点击关闭
  document.getElementById('overlay').onclick = closeAllDrawers;
  
  // 初始化POI控制
  setupPoiControls();
  
  // 默认选择基本设施POI类型
  setTimeout(() => {
    const basicTypes = ['toilets', 'restaurant', 'entrance', 'information', 'fountain'];
    basicTypes.forEach(type => {
      const item = document.querySelector(`.poi-item[data-type="${type}"]`);
      if (item) item.classList.add('active');
    });
    
    // 延迟加载POI，确保地图已初始化
    setTimeout(() => {
      console.log('[POI] 默认加载基本设施');
      reloadPOI();
    }, 1000);
  }, 500);
  
  // 路径规划按钮事件
  window.startPickStart = function() {
    pickMode = 'start';
    closeAllDrawers();
    showPickHint('请在地图上点击选择起点');
    showToast('请在地图上选择起点', 'info');
  };
  
  window.startPickEnd = function() {
    pickMode = 'end';
    closeAllDrawers();
    showPickHint('请在地图上点击选择终点');
    showToast('请在地图上选择终点', 'info');
  };
  
  window.clearRoute = function() {
    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);
    if (routeLine) map.removeLayer(routeLine);
    
    startLatLng = null;
    endLatLng = null;
    startMarker = null;
    endMarker = null;
    routeLine = null;
    pickMode = null;
    
    hidePickHint();
    hideRouteInfo();
    showToast('路径已清除', 'info');
  };
  
  // 点击地图时收起FAB菜单
  map.on('click', closeFabMenu);
});

// FAB菜单控制
function toggleFabMenu() {
  const fabContainer = document.getElementById('fabContainer');
  const mainFab = document.getElementById('mainFab');
  
  if (fabContainer.classList.contains('expanded')) {
    fabContainer.classList.remove('expanded');
    mainFab.innerHTML = '☰';
  } else {
    fabContainer.classList.add('expanded');
    mainFab.innerHTML = '✕';
  }
}

// 点击其他地方时收起FAB菜单
function closeFabMenu() {
  const fabContainer = document.getElementById('fabContainer');
  const mainFab = document.getElementById('mainFab');
  
  if (fabContainer.classList.contains('expanded')) {
    fabContainer.classList.remove('expanded');
    mainFab.innerHTML = '☰';
  }
}
