# The API's image, built on the dev machine and loaded on the home server (D55). Run it with
# compose.yaml.

FROM eclipse-temurin:27-jdk AS build
WORKDIR /src
COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle gradle
# No tests here: they need Node (jsTest). Run `./gradlew check` before deploying.
COPY src/main src/main
# Gradle's distribution and the dependencies stay in a cache between builds.
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon bootJar \
	&& cp build/libs/inkpost-api-*.jar /app.jar

FROM eclipse-temurin:27-jre
# For the health check: the base image has neither curl nor wget.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends curl \
	&& rm -rf /var/lib/apt/lists/*
# The SQLite file (D40) goes in /data, a volume. The directory belongs to the app's user, so a new
# volume starts out writable.
RUN mkdir /data && chown 1000:1000 /data
ENV INKPOST_DB_PATH=/data/inkpost.db
COPY --from=build /app.jar /app/app.jar
USER 1000:1000
EXPOSE 8080
HEALTHCHECK --start-period=60s CMD curl -fsS http://localhost:8080/actuator/health || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
