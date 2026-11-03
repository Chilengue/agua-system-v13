# syntax=docker/dockerfile:1
# ---- build ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
ENV MAVEN_OPTS="-Daether.connector.http.retryHandler.count=10 -Daether.connector.connectTimeout=60000 -Daether.connector.requestTimeout=600000"
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn -B dependency:go-offline
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B package -DskipTests

# ---- runtime ----
FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd -r -u 10001 agua
COPY --from=build /app/target/agua-system-*.jar app.jar
USER agua
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
