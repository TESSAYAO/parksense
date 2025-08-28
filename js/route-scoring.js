/**
 * ParkSense 智能筛选器核心算法实现
 * 基于多维度评分的路线推荐系统
 * 
 * @version 1.0
 * @author ParkSense Team
 */

class RouteScorer {
  constructor() {
    // 默认权重配置
    this.defaultWeights = {
      environment: 0.3,   // 环境条件权重 (30%)
      wildlife: 0.25,     // 野生动物权重 (25%)
      facility: 0.2,      // 设施便利权重 (20%)
      path: 0.15,         // 路径质量权重 (15%)
      personal: 0.1       // 用户偏好权重 (10%)
    };
    
    // 伦敦地区野生动物活跃时间模式
    this.wildlifePatterns = {
      birds: [6, 7, 8, 17, 18, 19],        // 鸟类活跃时间
      squirrels: [8, 9, 10, 15, 16, 17],   // 松鼠活跃时间
      ducks: [7, 8, 9, 16, 17, 18],        // 鸭子活跃时间
      swans: [7, 8, 9, 10, 16, 17, 18]     // 天鹅活跃时间
    };
  }

  /**
   * 主要路线评分函数
   * @param {Object} route - 路线对象
   * @param {Object} preferences - 用户偏好设置
   * @param {Object} context - 环境上下文（天气、时间等）
   * @returns {Object} 评分结果
   */
  calculateScore(route, preferences = {}, context = {}) {
    // 计算各维度分数
    const weatherScore = this.calculateWeatherScore(route, context.weather || {});
    const wildlifeScore = this.calculateWildlifeScore(route, context.time || new Date(), context.season || 'spring');
    const facilityScore = this.calculateFacilityScore(route, preferences.needs || {});
    const pathScore = this.calculatePathQuality(route);
    const personalScore = this.calculatePersonalPreference(route, preferences);

    // 动态调整权重
    const weights = this.adjustWeights(preferences);

    // 计算总分
    const totalScore = 
      weatherScore * weights.environment +
      wildlifeScore * weights.wildlife +
      facilityScore * weights.facility +
      pathScore * weights.path +
      personalScore * weights.personal;

    return {
      total: Math.round(totalScore * 100) / 100, // 保留2位小数
      breakdown: {
        weather: Math.round(weatherScore * 100) / 100,
        wildlife: Math.round(wildlifeScore * 100) / 100,
        facility: Math.round(facilityScore * 100) / 100,
        path: Math.round(pathScore * 100) / 100,
        personal: Math.round(personalScore * 100) / 100
      },
      weights: weights,
      reasons: this.generateReasons(weatherScore, wildlifeScore, facilityScore, pathScore, personalScore, preferences)
    };
  }

  /**
   * 天气条件评分算法
   * @param {Object} route - 路线对象
   * @param {Object} weatherData - 天气数据
   * @returns {number} 0-1之间的分数
   */
  calculateWeatherScore(route, weatherData) {
    let score = 0.5; // 基础分数

    const {
      precipitation = 0,
      temperature = 15,
      windSpeed = 5,
      humidity = 60,
      sunny = true
    } = weatherData;

    // 降雨逻辑
    if (precipitation > 0) {
      const shelterCoverage = route.shelterCoverage || 0.3; // 默认30%遮蔽
      score = shelterCoverage * 0.8;
      
      if (precipitation > 5) { // 大雨
        score *= 0.6;
      } else if (precipitation > 2) { // 中雨
        score *= 0.8;
      }
    }

    // 晴天高温逻辑
    if (sunny && temperature > 25) {
      const shadeCoverage = route.shadeCoverage || 0.4; // 默认40%阴凉
      score = shadeCoverage * 0.9;
      
      if (temperature > 30) { // 高温
        score *= 0.7;
      }
    }

    // 适宜温度加分
    if (temperature >= 15 && temperature <= 25 && precipitation === 0) {
      score = Math.max(score, 0.8);
    }

    // 风力影响
    if (windSpeed > 15) {
      const exposureLevel = route.exposureLevel || 0.5; // 默认50%暴露
      score *= (1 - exposureLevel * 0.3);
    }

    // 湿度影响
    if (humidity > 80) {
      score *= 0.9;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 野生动物概率评分算法
   * @param {Object} route - 路线对象
   * @param {Date} currentTime - 当前时间
   * @param {string} season - 季节
   * @returns {number} 0-1之间的分数
   */
  calculateWildlifeScore(route, currentTime, season) {
    const hour = currentTime.getHours();
    
    // 时间因子
    const timeScore = this.getTimeBasedProbability(hour, route.wildlifeData || {});
    
    // 季节因子
    const seasonScore = this.getSeasonalProbability(season, route.species || []);
    
    // 历史数据因子（模拟）
    const historicalScore = route.wildlifeHistory || 0.6;
    
    // 用户贡献数据因子（模拟最近24小时的目击）
    const recentSightings = route.recentSightings || [];
    const contributionScore = Math.min(1, recentSightings.length / 10);
    
    // 地理位置因子（靠近水体和绿地的加分）
    const locationScore = this.calculateWildlifeLocationScore(route);
    
    // 加权平均
    return (
      timeScore * 0.25 + 
      seasonScore * 0.2 + 
      historicalScore * 0.25 + 
      contributionScore * 0.15 + 
      locationScore * 0.15
    );
  }

  /**
   * 基于时间的野生动物概率
   * @param {number} hour - 小时 (0-23)
   * @param {Object} wildlifeData - 野生动物数据
   * @returns {number} 0-1之间的概率
   */
  getTimeBasedProbability(hour, wildlifeData) {
    let probability = 0;
    
    Object.keys(this.wildlifePatterns).forEach(species => {
      if (this.wildlifePatterns[species].includes(hour)) {
        probability += wildlifeData[species] || 0.2; // 默认每种动物20%基础概率
      }
    });
    
    return Math.min(1, probability);
  }

  /**
   * 季节性野生动物概率
   * @param {string} season - 季节
   * @param {Array} species - 路线上的物种列表
   * @returns {number} 0-1之间的概率
   */
  getSeasonalProbability(season, species) {
    const seasonalMultipliers = {
      spring: { birds: 1.2, squirrels: 1.0, ducks: 1.1, swans: 0.9 },
      summer: { birds: 1.0, squirrels: 1.2, ducks: 0.8, swans: 0.8 },
      autumn: { birds: 1.1, squirrels: 1.3, ducks: 1.0, swans: 1.0 },
      winter: { birds: 0.7, squirrels: 0.6, ducks: 1.2, swans: 1.3 }
    };
    
    const multipliers = seasonalMultipliers[season] || seasonalMultipliers.spring;
    
    let totalScore = 0;
    species.forEach(speciesName => {
      totalScore += (multipliers[speciesName] || 1.0) * 0.2;
    });
    
    return Math.min(1, totalScore);
  }

  /**
   * 野生动物地理位置评分
   * @param {Object} route - 路线对象
   * @returns {number} 0-1之间的分数
   */
  calculateWildlifeLocationScore(route) {
    let score = 0.3; // 基础分数
    
    // 靠近水体加分
    if (route.nearWater) {
      score += 0.3;
    }
    
    // 绿地覆盖率加分
    const vegetationCoverage = route.vegetationCoverage || 0.5;
    score += vegetationCoverage * 0.4;
    
    // 安静程度加分（人流密度低）
    const quietness = 1 - (route.crowdDensity || 0.5);
    score += quietness * 0.3;
    
    return Math.min(1, score);
  }

  /**
   * 设施便利性评分算法
   * @param {Object} route - 路线对象
   * @param {Object} userNeeds - 用户需求
   * @returns {number} 0-1之间的分数
   */
  calculateFacilityScore(route, userNeeds) {
    const facilities = route.facilities || [];
    
    // 基础设施评分
    const basicFacilities = ['toilet', 'bench', 'water'];
    const basicScore = basicFacilities.reduce((sum, type) => {
      const count = facilities.filter(f => f.type === type).length;
      const density = count / Math.max(1, (route.distance || 1000) / 1000); // 每公里设施数
      return sum + Math.min(1, density / 2); // 标准化到0-1
    }, 0) / basicFacilities.length;
    
    // 可达性评分（设施分布均匀度）
    const accessibilityScore = this.calculateFacilityDistribution(facilities, route);
    
    // 用户特定需求评分
    const personalScore = this.calculatePersonalFacilityScore(facilities, userNeeds);
    
    // 设施状态评分（开放/维护状态）
    const statusScore = this.calculateFacilityStatus(facilities);
    
    return (
      basicScore * 0.3 + 
      accessibilityScore * 0.25 + 
      personalScore * 0.25 + 
      statusScore * 0.2
    );
  }

  /**
   * 计算设施分布均匀度
   * @param {Array} facilities - 设施列表
   * @param {Object} route - 路线对象
   * @returns {number} 0-1之间的分数
   */
  calculateFacilityDistribution(facilities, route) {
    if (facilities.length === 0) return 0;
    
    // 简化计算：假设设施在路线上均匀分布
    const routeLength = route.distance || 1000;
    const idealSpacing = routeLength / Math.max(1, facilities.length);
    const actualSpacing = routeLength / facilities.length;
    
    // 计算分布均匀度
    const uniformity = 1 - Math.abs(idealSpacing - actualSpacing) / idealSpacing;
    return Math.max(0, Math.min(1, uniformity));
  }

  /**
   * 用户个人设施需求评分
   * @param {Array} facilities - 设施列表
   * @param {Object} userNeeds - 用户需求
   * @returns {number} 0-1之间的分数
   */
  calculatePersonalFacilityScore(facilities, userNeeds) {
    if (!userNeeds || Object.keys(userNeeds).length === 0) return 0.5;
    
    let score = 0;
    let totalNeeds = 0;
    
    Object.keys(userNeeds).forEach(need => {
      if (userNeeds[need]) {
        totalNeeds++;
        const hasNeed = facilities.some(f => f.type === need);
        if (hasNeed) score++;
      }
    });
    
    return totalNeeds > 0 ? score / totalNeeds : 0.5;
  }

  /**
   * 设施状态评分
   * @param {Array} facilities - 设施列表
   * @returns {number} 0-1之间的分数
   */
  calculateFacilityStatus(facilities) {
    if (facilities.length === 0) return 0.5;
    
    const openFacilities = facilities.filter(f => f.status !== 'closed' && f.status !== 'maintenance');
    return openFacilities.length / facilities.length;
  }

  /**
   * 路径质量评分算法
   * @param {Object} route - 路线对象
   * @returns {number} 0-1之间的分数
   */
  calculatePathQuality(route) {
    let score = 0.5; // 基础分数
    
    // 路面状况
    const surfaceQuality = route.surfaceQuality || 0.7; // 默认70%
    score += surfaceQuality * 0.3;
    
    // 坡度影响
    const gradient = route.gradient || 0.05; // 默认5%坡度
    const gradientScore = Math.max(0, 1 - gradient * 10); // 坡度越大分数越低
    score += gradientScore * 0.2;
    
    // 安全性
    const safety = route.safety || 0.8; // 默认80%安全
    score += safety * 0.3;
    
    // 景观质量
    const scenery = route.scenery || 0.6; // 默认60%景观
    score += scenery * 0.2;
    
    return Math.min(1, score);
  }

  /**
   * 用户个人偏好评分
   * @param {Object} route - 路线对象
   * @param {Object} preferences - 用户偏好
   * @returns {number} 0-1之间的分数
   */
  calculatePersonalPreference(route, preferences) {
    if (!preferences || Object.keys(preferences).length === 0) return 0.5;
    
    let score = 0.5;
    
    // 距离偏好
    if (preferences.preferredDistance) {
      const distanceDiff = Math.abs((route.distance || 1000) - preferences.preferredDistance);
      const distanceScore = Math.max(0, 1 - distanceDiff / preferences.preferredDistance);
      score += distanceScore * 0.3;
    }
    
    // 难度偏好
    if (preferences.difficultyLevel) {
      const routeDifficulty = route.difficulty || 'easy';
      const matchScore = routeDifficulty === preferences.difficultyLevel ? 1 : 0.5;
      score += matchScore * 0.2;
    }
    
    // 主题偏好
    if (preferences.interests && route.themes) {
      const commonInterests = preferences.interests.filter(interest => 
        route.themes.includes(interest)
      );
      const interestScore = commonInterests.length / Math.max(1, preferences.interests.length);
      score += interestScore * 0.3;
    }
    
    // 时间偏好
    if (preferences.preferredDuration) {
      const timeDiff = Math.abs((route.estimatedTime || 30) - preferences.preferredDuration);
      const timeScore = Math.max(0, 1 - timeDiff / preferences.preferredDuration);
      score += timeScore * 0.2;
    }
    
    return Math.min(1, score);
  }

  /**
   * 动态权重调整
   * @param {Object} preferences - 用户偏好
   * @returns {Object} 调整后的权重
   */
  adjustWeights(preferences) {
    const weights = { ...this.defaultWeights };
    
    if (!preferences) return weights;
    
    // 野生动物优先
    if (preferences.prioritizeWildlife) {
      weights.wildlife += 0.15;
      weights.environment -= 0.1;
      weights.facility -= 0.05;
    }
    
    // 天气敏感
    if (preferences.weatherSensitive) {
      weights.environment += 0.2;
      weights.wildlife -= 0.1;
      weights.path -= 0.1;
    }
    
    // 设施依赖
    if (preferences.facilityDependent) {
      weights.facility += 0.15;
      weights.wildlife -= 0.05;
      weights.path -= 0.1;
    }
    
    // 路径质量优先
    if (preferences.prioritizePathQuality) {
      weights.path += 0.15;
      weights.personal -= 0.05;
      weights.environment -= 0.1;
    }
    
    return weights;
  }

  /**
   * 生成推荐理由
   * @param {number} weatherScore - 天气分数
   * @param {number} wildlifeScore - 野生动物分数
   * @param {number} facilityScore - 设施分数
   * @param {number} pathScore - 路径分数
   * @param {number} personalScore - 个人偏好分数
   * @param {Object} preferences - 用户偏好
   * @returns {Array} 推荐理由列表
   */
  generateReasons(weatherScore, wildlifeScore, facilityScore, pathScore, personalScore, preferences) {
    const reasons = [];
    
    // 天气相关理由
    if (weatherScore > 0.8) {
      reasons.push("🌤️ 当前天气条件非常适合此路线");
    } else if (weatherScore < 0.4) {
      reasons.push("⛈️ 天气条件一般，建议关注遮蔽设施");
    }
    
    // 野生动物相关理由
    if (wildlifeScore > 0.7) {
      reasons.push("🦋 野生动物活跃度高，观赏机会多");
    } else if (wildlifeScore > 0.5) {
      reasons.push("🐿️ 有机会遇到野生动物");
    }
    
    // 设施相关理由
    if (facilityScore > 0.8) {
      reasons.push("🚻 设施完善，便民服务齐全");
    } else if (facilityScore < 0.4) {
      reasons.push("⚠️ 设施较少，建议提前准备");
    }
    
    // 路径质量相关理由
    if (pathScore > 0.8) {
      reasons.push("🛤️ 路径状况良好，行走舒适");
    } else if (pathScore < 0.5) {
      reasons.push("⚡ 路径有一定挑战性");
    }
    
    // 个人偏好相关理由
    if (personalScore > 0.7) {
      reasons.push("❤️ 符合您的个人偏好");
    }
    
    // 特殊偏好理由
    if (preferences?.prioritizeWildlife && wildlifeScore > 0.6) {
      reasons.push("🎯 推荐给野生动物爱好者");
    }
    
    if (preferences?.weatherSensitive && weatherScore > 0.7) {
      reasons.push("☂️ 天气友好路线");
    }
    
    return reasons.slice(0, 3); // 最多返回3个理由
  }

  /**
   * 推荐Top2路线
   * @param {Array} allRoutes - 所有路线
   * @param {Object} userFilters - 用户筛选条件
   * @param {Object} userLocation - 用户位置
   * @param {Object} userProfile - 用户档案
   * @returns {Array} 推荐的前2条路线
   */
  recommendRoutes(allRoutes, userFilters = {}, userLocation = null, userProfile = {}) {
    // 第一步：预筛选
    const eligibleRoutes = allRoutes.filter(route => 
      this.meetsBasicCriteria(route, userFilters)
    );
    
    if (eligibleRoutes.length === 0) {
      return [];
    }
    
    // 第二步：多维度评分
    const context = {
      weather: userFilters.weather || this.getCurrentWeather(),
      time: new Date(),
      season: this.getCurrentSeason()
    };
    
    const scoredRoutes = eligibleRoutes.map(route => {
      const scoreResult = this.calculateScore(route, userProfile, context);
      
      // 计算距离（如果有用户位置）
      let distanceScore = 0.5;
      if (userLocation && route.startPoint) {
        const distance = this.calculateDistance(userLocation, route.startPoint);
        distanceScore = Math.max(0, 1 - distance / 5000); // 5km内满分
      }
      
      return {
        ...route,
        score: scoreResult.total,
        breakdown: scoreResult.breakdown,
        weights: scoreResult.weights,
        reasons: scoreResult.reasons,
        distanceFromUser: userLocation ? this.calculateDistance(userLocation, route.startPoint) : null,
        distanceScore: distanceScore
      };
    });
    
    // 第三步：排序和选择
    const sortedRoutes = scoredRoutes.sort((a, b) => {
      // 主要按评分排序，距离作为次要因素
      const scoreDiff = b.score - a.score;
      if (Math.abs(scoreDiff) < 0.1) {
        return a.distanceScore - b.distanceScore; // 距离越近越好
      }
      return scoreDiff;
    });
    
    // 确保多样性：如果前两条路线太相似，替换第二条
    const top2 = sortedRoutes.slice(0, 2);
    if (top2.length === 2 && this.areRoutesSimilar(top2[0], top2[1])) {
      // 寻找不同类型的路线作为第二选择
      for (let i = 2; i < sortedRoutes.length; i++) {
        if (!this.areRoutesSimilar(top2[0], sortedRoutes[i])) {
          top2[1] = sortedRoutes[i];
          break;
        }
      }
    }
    
    return top2;
  }

  /**
   * 检查路线是否满足基本筛选条件
   * @param {Object} route - 路线对象
   * @param {Object} filters - 筛选条件
   * @returns {boolean} 是否满足条件
   */
  meetsBasicCriteria(route, filters) {
    // 距离筛选
    if (filters.maxDistance && route.distance > filters.maxDistance) {
      return false;
    }
    
    if (filters.minDistance && route.distance < filters.minDistance) {
      return false;
    }
    
    // 时间筛选
    if (filters.maxDuration && route.estimatedTime > filters.maxDuration) {
      return false;
    }
    
    // 难度筛选
    if (filters.difficulty && route.difficulty !== filters.difficulty) {
      return false;
    }
    
    // 无障碍需求
    if (filters.accessible && !route.accessible) {
      return false;
    }
    
    return true;
  }

  /**
   * 判断两条路线是否相似
   * @param {Object} route1 - 路线1
   * @param {Object} route2 - 路线2
   * @returns {boolean} 是否相似
   */
  areRoutesSimilar(route1, route2) {
    // 距离相似度
    const distanceSimilarity = Math.abs(route1.distance - route2.distance) / Math.max(route1.distance, route2.distance);
    
    // 主题相似度
    const themes1 = route1.themes || [];
    const themes2 = route2.themes || [];
    const commonThemes = themes1.filter(theme => themes2.includes(theme));
    const themeSimilarity = commonThemes.length / Math.max(themes1.length, themes2.length, 1);
    
    // 如果距离相似度小于20%且主题相似度大于60%，认为相似
    return distanceSimilarity < 0.2 && themeSimilarity > 0.6;
  }

  /**
   * 计算两点间距离（简化版）
   * @param {Object} point1 - 点1 {lat, lng}
   * @param {Object} point2 - 点2 {lat, lng}
   * @returns {number} 距离（米）
   */
  calculateDistance(point1, point2) {
    const R = 6371e3; // 地球半径（米）
    const φ1 = point1.lat * Math.PI / 180;
    const φ2 = point2.lat * Math.PI / 180;
    const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
    const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * 获取当前天气（模拟）
   * @returns {Object} 天气数据
   */
  getCurrentWeather() {
    // 模拟天气数据
    return {
      temperature: 18,
      precipitation: 0,
      windSpeed: 8,
      humidity: 65,
      sunny: true
    };
  }

  /**
   * 获取当前季节
   * @returns {string} 季节
   */
  getCurrentSeason() {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
  }
}

// 导出类供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RouteScorer;
} else if (typeof window !== 'undefined') {
  window.RouteScorer = RouteScorer;
}

/**
 * 使用示例：
 * 
 * const scorer = new RouteScorer();
 * 
 * const route = {
 *   id: 'route1',
 *   distance: 1200,
 *   estimatedTime: 15,
 *   difficulty: 'easy',
 *   facilities: [
 *     {type: 'toilet', status: 'open'},
 *     {type: 'bench', status: 'open'},
 *     {type: 'water', status: 'open'}
 *   ],
 *   wildlifeData: {birds: 0.8, squirrels: 0.6},
 *   shelterCoverage: 0.4,
 *   shadeCoverage: 0.6,
 *   nearWater: true,
 *   vegetationCoverage: 0.7
 * };
 * 
 * const preferences = {
 *   prioritizeWildlife: true,
 *   needs: {toilet: true, water: true}
 * };
 * 
 * const result = scorer.calculateScore(route, preferences);
 * console.log('路线评分:', result.total);
 * console.log('推荐理由:', result.reasons);
 */