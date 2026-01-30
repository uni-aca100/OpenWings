## Getting Started

### Dependencies
- Docker and Docker Compose (or the `docker compose` plugin or `docker-compose` CLI)
    - Docker postgis/postgis Image, tag  **postgis/postgis:18-3.6** for PostgreSQL/PostGIS database (postgres:18 with PostGIS extension)
    - Docker Node Image, tag **node:lts-alpine3.23** for Node.js (LTS, 24.13.0)
        - npm (comes with Node.js) package dependencies declared in `package.json`, notably `pg` for PostgreSQL client
- file .env (root directory) for environment variable management (POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB)

### Setup
1. Clone the repository to your local machine.
2. Navigate to the project directory.
3. Build and start the Docker containers using Docker Compose:
   ```bash
   docker compose up --build
   # Or, if using docker-compose CLI:
   # docker-compose up --build
   # or if the image is already built:
   # docker compose up
   # docker-compose up
   ```
4. The application should now be running and accessible at `http://localhost:3000`.
5. To stop the application, use:
   ```bash
   docker compose down
   ```
6. Use a tool (e.g., `shp2pgsql` or `ogr2ogr`) to load a shapefile (from the spatial data available source) into the PostGIS database, inserting the data into the `species_ranges` table.
```sql
-- table species_range, storing geographical ranges of bird species
CREATE TABLE species_range (
  species_scientific_name TEXT,
  season TEXT, 
  geom GEOMETRY(MULTIPOLYGON, 4326)
);
```