# --- Stage 1: Builder & Development ---
FROM golang:1.25-alpine AS builder

RUN apk add --no-cache git
RUN go install github.com/air-verse/air@latest

WORKDIR /app

# Files are now in the root
COPY go.mod go.sum* ./
RUN go mod download || true

COPY . .

# Build from the new entry point: cmd/api/main.go
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /main ./cmd/api

# --- Stage 2: Dev Target ---
FROM builder AS dev
WORKDIR /app
CMD ["air", "-c", ".air.toml"]

# --- Stage 3: Production Runner ---
FROM alpine:3.23 AS runner
RUN adduser -D appuser
USER appuser
WORKDIR /home/appuser
COPY --from=builder /main .
EXPOSE 8080
CMD ["./main"]