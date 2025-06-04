import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Coordinates } from '../../../core/domain/value-objects/coordinates.value-object';

@Injectable()
export class GeoService {
  constructor(private readonly configService: ConfigService) {}

  async getAddressFromCoordinates(
    coordinates: Coordinates,
  ): Promise<string | null> {
    // This is a placeholder implementation
    // In a real application, this would make a call to a geocoding API like Google Maps

    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Example of how to get API key from config
      const apiKey = this.configService.get<string>('env.geoApiKey');

      // For demo purpose, we'll just return a basic formatted address
      return `Latitude: ${coordinates.latitude}, Longitude: ${coordinates.longitude}`;
    } catch (error) {
      console.error('Error getting address from coordinates:', error);
      return null;
    }
  }

  async getCoordinatesFromAddress(
    address: string,
  ): Promise<Coordinates | null> {
    // This is a placeholder implementation
    // In a real application, this would make a call to a geocoding API

    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Example of how to get API key from config
      const apiKey = this.configService.get<string>('env.geoApiKey');

      // For demo purpose, we'll just return random coordinates
      const latitude = Math.random() * 180 - 90;
      const longitude = Math.random() * 360 - 180;

      return new Coordinates(latitude, longitude);
    } catch (error) {
      console.error('Error getting coordinates from address:', error);
      return null;
    }
  }

  calculateDistance(point1: Coordinates, point2: Coordinates): number {
    // Calculate distance between two points using the Haversine formula
    const R = 6371; // Radius of the Earth in km
    const dLat = this.deg2rad(point2.latitude - point1.latitude);
    const dLon = this.deg2rad(point2.longitude - point1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(point1.latitude)) *
        Math.cos(this.deg2rad(point2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km

    return distance;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
