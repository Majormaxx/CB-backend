import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { container } from './inversify.config.js';
import { App } from './app.js';
import { AppDataSource } from './data-source.js';

// Initialize configuration
dotenv.config();

(async () => {
  let server;
  try {
    // Initialize the data source first
    await AppDataSource.initialize();
    console.log('App Data Source Connected');

    // Then start the application server
    const application = container.get<App>(App);
    server = application.app.listen(process.env.PORT, () => {
      console.log(`Server started at http://localhost:${process.env.PORT}.`);
    });
  } catch (err) {
    if (server?.listening) {
      server.close();
    }
    console.error('Failed to start the server:', err);
    process.exit(1);
  }
})();
