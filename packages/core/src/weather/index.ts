/**
 * Weather Module
 *
 * Provides weather data services for agricultural applications.
 * Integrates with Taiwan's Central Weather Administration (CWA) API.
 */

export {
  CWAClient,
  CWAClientError,
  TAIWAN_COUNTIES,
  type CWAWeatherForecast,
  type CWAWeatherAlert,
  type WeatherAlertType,
  type AgriculturalAdvisory,
  type CurrentWeather,
} from './cwa-client';

export { WeatherService, createWeatherService, type WeatherServiceConfig } from './weather-service';
