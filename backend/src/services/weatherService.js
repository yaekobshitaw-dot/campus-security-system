// src/services/weatherService.js
const axios = require('axios');

const getWeather = async (lat, lon) => {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey || apiKey === 'your_openweather_api_key') {
      console.log('Weather API key not configured');
      return null;
    }
    const url = 'https://api.openweathermap.org/data/2.5/weather?lat=' + lat + '&lon=' + lon + '&units=metric&appid=' + apiKey;
    const response = await axios.get(url);
    return {
      temperature: response.data.main.temp,
      feels_like: response.data.main.feels_like,
      humidity: response.data.main.humidity,
      weather: response.data.weather[0].description,
      icon: response.data.weather[0].icon,
      wind_speed: response.data.wind.speed,
      pressure: response.data.main.pressure
    };
  } catch (error) {
    console.error('Weather API error:', error.message);
    return null;
  }
};

const getWeatherAlert = async (lat, lon) => {
  try {
    const weather = await getWeather(lat, lon);
    if (!weather) return null;
    
    const alerts = [];
    if (weather.temperature > 35) alerts.push('Heat warning: Temperature is above 35 C');
    if (weather.temperature < 0) alerts.push('Freezing warning: Temperature is below 0 C');
    if (weather.wind_speed > 20) alerts.push('Strong winds: Wind speed above 20 km/h');
    if (weather.weather && (weather.weather.includes('thunder') || weather.weather.includes('storm'))) {
      alerts.push('Storm warning: Thunderstorms detected');
    }
    
    return { weather: weather, alerts: alerts, hasAlert: alerts.length > 0 };
  } catch (error) {
    console.error('Weather alert error:', error);
    return null;
  }
};

module.exports = { getWeather, getWeatherAlert };
