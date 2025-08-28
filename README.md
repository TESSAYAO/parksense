# ParkSense 🌳

A smart park navigation application that helps visitors find optimal routes through parks with minimal screen time, focusing on wildlife sightings and peaceful walking experiences.

## Features 🚀

- **Smart Route Planning**: AI-powered route recommendations based on user preferences
- **Wildlife Spotting**: Real-time wildlife activity predictions and sightings
- **Weather Integration**: Route optimization based on current weather conditions
- **Multi-layered Map**: Interactive map with vegetation, water features, trails, and facilities
- **Minimal Screen Time**: Designed for a calm, nature-focused experience
- **Mobile-First Design**: Optimized for mobile devices with touch-friendly interface

## Live Demo 🌐

- **Main Application**: [ParkSense](https://your-username.github.io/parksen/)
- **Debug Version**: [Debug Interface](https://your-username.github.io/parksen/prototype/)

## Tech Stack 💻

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Mapping**: Leaflet.js with OpenStreetMap tiles
- **Data**: GeoJSON for park features and POI data
- **Deployment**: GitHub Pages with GitHub Actions
- **Architecture**: Progressive Web App (PWA) ready

## Project Structure 📁

```
parksen/
├── index.html                 # Main mobile application
├── bg.jpg                     # Background image
├── js/
│   ├── parksense-mobile-complete.js  # Main application logic
│   └── route-scoring.js       # Route recommendation algorithm
├── local-nav/
│   └── local-nav/park-data/park-data/
│       ├── *.geojson         # Park geographical data
│       └── 部分区域实际图片预览/  # Area preview images
├── 地图功能原型/
│   ├── parksense-web-debug-clean.html  # Debug interface
│   └── js/
│       └── parksense-mobile-complete.js
└── .github/workflows/
    └── deploy.yml            # GitHub Actions deployment
```

## Getting Started 🏁

### Prerequisites

- Modern web browser with JavaScript enabled
- Internet connection for map tiles and weather data

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/parksen.git
   cd parksen
   ```

2. **Serve locally** (due to CORS restrictions with GeoJSON files)
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve .
   
   # Using PHP
   php -S localhost:8000
   ```

3. **Open in browser**
   ```
   http://localhost:8000
   ```

### Deployment

The project is automatically deployed to GitHub Pages using GitHub Actions when changes are pushed to the main branch.

To set up deployment for your fork:
1. Go to repository Settings → Pages
2. Set Source to "GitHub Actions"
3. Push changes to trigger deployment

## Usage Guide 📱

### Main Application

1. **Select Park**: Choose from available parks (currently focused on St. James's Park, London)
2. **Set Preferences**: Use the filter system to customize your route:
   - Atmosphere (quiet, shaded, scenic)
   - Wildlife interests (birds, ducks, swans, squirrels)
   - Seasonal features (cherry blossoms, autumn colors)
   - Infrastructure needs (toilets, benches, water fountains)
   - Route duration (15min, 30min, 1 hour)

3. **Get Recommendations**: The AI system provides top 2 route suggestions with scoring based on:
   - Weather conditions
   - Wildlife activity patterns
   - Facility availability
   - Personal preferences

4. **Navigate**: Start navigation with real-time updates and wildlife alerts

### Debug Interface

Access the debug version at `/prototype/` for:
- Advanced layer controls
- POI data analysis
- Manual route planning
- Data visualization tools

## Data Sources 📊

- **Geographic Data**: Custom GeoJSON datasets for St. James's Park
- **Weather API**: OpenWeatherMap integration
- **Map Tiles**: OpenStreetMap
- **Wildlife Data**: Simulated based on real patterns (community contribution ready)

## Contributing 🤝

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Areas

- [ ] Additional park datasets
- [ ] Real wildlife sighting integration
- [ ] Offline functionality
- [ ] AR waypoint features
- [ ] Community photo sharing
- [ ] Accessibility improvements

## API Integration 🔌

### Weather API Setup

To use real weather data, add your OpenWeatherMap API key:
1. Sign up at [OpenWeatherMap](https://openweathermap.org/api)
2. Replace the API key in the weather integration code
3. Update the API endpoint for your location

### Wildlife Data

The application is designed to integrate with real wildlife tracking APIs. Current implementation uses simulated data for demonstration.

## Browser Support 🌍

- ✅ Chrome 90+
- ✅ Firefox 85+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Performance 📈

- Lazy loading of map layers
- Optimized GeoJSON data structure
- Efficient route calculation algorithms
- Mobile-optimized interface
- Progressive enhancement

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments 🙏

- OpenStreetMap contributors for map data
- Leaflet.js team for the excellent mapping library
- St. James's Park for inspiration and location data
- Wildlife conservation organizations for ecological insights

---

**ParkSense** - Enjoy calmer walks with minimal screen time 🌿

For questions or support, please open an issue or contact the development team.
