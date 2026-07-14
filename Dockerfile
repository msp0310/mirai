# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS frontend-build

WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts

COPY frontend/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api-build

WORKDIR /src
COPY global.json ./
COPY backend/ScheduleManager.sln ./backend/
COPY backend/src/Schedule.Api/Schedule.Api.csproj ./backend/src/Schedule.Api/
RUN dotnet restore backend/src/Schedule.Api/Schedule.Api.csproj

COPY backend/ ./backend/
RUN dotnet publish backend/src/Schedule.Api/Schedule.Api.csproj \
    --configuration Release \
    --output /app/publish \
    --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime

WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080 \
    ConnectionStrings__ScheduleDb="Data Source=/data/compass.db" \
    Attachments__RootPath="/data/attachments"

COPY --from=api-build /app/publish ./
COPY --from=frontend-build /src/frontend/dist ./wwwroot

RUN mkdir -p /data/attachments && chown -R app:app /data /app
VOLUME ["/data"]
EXPOSE 8080

USER app
ENTRYPOINT ["dotnet", "Schedule.Api.dll"]
