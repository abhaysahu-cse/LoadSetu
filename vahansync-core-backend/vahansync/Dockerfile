FROM maven:3.9-eclipse-temurin-21-alpine AS builder

WORKDIR /build

COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn clean package -DskipTests -B

FROM eclipse-temurin:21-jre-alpine

RUN apk add --no-cache curl

RUN addgroup -g 1001 vahansync && \
    adduser -D -u 1001 -G vahansync vahansync

WORKDIR /app

COPY --from=builder /build/target/*.jar app.jar

RUN chown -R vahansync:vahansync /app

USER vahansync

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/actuator/health || exit 1

ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+UseG1GC -XX:+OptimizeStringConcat"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
