# Build the API, migration, and offline admin binaries in a reproducible Go image.
FROM golang:1.27.1-bookworm AS build

WORKDIR /src/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /out/soba-api ./cmd/api \
    && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /out/soba-migrate ./cmd/migrate \
    && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /out/soba-admin ./cmd/admin \
    && mkdir -p /out/private-data \
    && chmod 0700 /out/private-data

FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app
COPY --from=build /out/soba-api /app/soba-api
COPY --from=build /out/soba-migrate /app/soba-migrate
COPY --from=build /out/soba-admin /app/soba-admin
COPY --from=build --chown=65532:65532 /out/private-data /app/private-data

USER nonroot:nonroot
ENTRYPOINT ["/app/soba-api"]
