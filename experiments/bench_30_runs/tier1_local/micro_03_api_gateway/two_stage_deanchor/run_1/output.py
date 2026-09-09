# Greenfield Implementation of Service Proxy & Webhook System

## Architecture Overview

This implementation follows a clean, modular architecture with clear separation of concerns. The system is composed of:

1. **Core Domain Layer**: Contains all business entities and their relationships
2. **Service Layer**: Implements functional operations as defined in the schema
3. **Infrastructure Layer**: Handles external dependencies like HTTP clients and storage
4. **API Layer**: Exposes endpoints for service interaction

## File Structure

```
src/
├── main/
│   ├── java/
│   │   └── com/
│   │       └── example/
│   │           └── proxy/
│   │               ├── domain/
│   │               │   ├── entities/
│   │               │   │   ├── ServiceEndpoint.java
│   │               │   │   ├── RequestContext.java
│   │               │   │   ├── ResponseContext.java
│   │               │   │   ├── WebhookSubscription.java
│   │               │   │   └── ProxyConfiguration.java
│   │               │   ├── events/
│   │               │   │   ├── ServiceStatusChangedEvent.java
│   │               │   │   ├── WebhookDeliveryAttemptedEvent.java
│   │               │   │   └── ConfigurationUpdatedEvent.java
│   │               │   └── exceptions/
│   │               │       ├── InvalidRequestException.java
│   │               │       ├── ServiceUnavailableException.java
│   │               │       └── WebhookDeliveryFailedException.java
│   │               ├── service/
│   │               │   ├── ForwardRequestService.java
│   │               │   ├── ProcessWebhookService.java
│   │               │   └── RouteRequestService.java
│   │               ├── infrastructure/
│   │               │   ├── http/
│   │               │   │   ├── HttpClientFactory.java
│   │               │   │   └── HttpServiceClient.java
│   │               │   ├── storage/
│   │               │   │   ├── ServiceEndpointRepository.java
│   │               │   │   ├── WebhookSubscriptionRepository.java
│   │               │   │   └── ProxyConfigurationRepository.java
│   │               │   └── security/
│   │               │       └── SignatureVerifier.java
│   │               ├── application/
│   │               │   ├── ForwardRequestHandler.java
│   │               │   ├── ProcessWebhookHandler.java
│   │               │   └── RouteRequestHandler.java
│   │               └── api/
│   │                   ├── ProxyController.java
│   │                   └── WebhookController.java
│   └── resources/
│       ├── application.yml
│       └── logback.xml
└── test/
    └── java/
        └── com/
            └── example/
                └── proxy/
                    ├── domain/
                    │   ├── entities/
                    │   │   ├── ServiceEndpointTest.java
                    │   │   └── RequestContextTest.java
                    │   └── events/
                    │       └── ServiceStatusChangedEventTest.java
                    ├── service/
                    │   ├── ForwardRequestServiceTest.java
                    │   ├── ProcessWebhookServiceTest.java
                    │   └── RouteRequestServiceTest.java
                    └── infrastructure/
                        └── http/
                            └── HttpServiceClientTest.java
```

## Core Domain Entities

### ServiceEndpoint.java
```java
package com.example.proxy.domain.entities;

import java.util.UUID;
import java.time.Duration;
import java.util.Objects;

public class ServiceEndpoint {
    private UUID id;
    private String url;
    private Duration timeout;
    private Integer retryAttempts;
    private Status status;

    public enum Status {
        ACTIVE, INACTIVE, ERROR
    }

    // Constructors
    public ServiceEndpoint() {}

    public ServiceEndpoint(UUID id, String url, Duration timeout, Integer retryAttempts, Status status) {
        this.id = id;
        this.url = url;
        this.timeout = timeout;
        this.retryAttempts = retryAttempts;
        this.status = status;
    }

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public Duration getTimeout() { return timeout; }
    public void setTimeout(Duration timeout) { this.timeout = timeout; }

    public Integer getRetryAttempts() { return retryAttempts; }
    public void setRetryAttempts(Integer retryAttempts) { this.retryAttempts = retryAttempts; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ServiceEndpoint)) return false;
        ServiceEndpoint that = (ServiceEndpoint) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
```

### RequestContext.java
```java
package com.example.proxy.domain.entities;

import java.util.UUID;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Objects;

public class RequestContext {
    private UUID requestId;
    private LocalDateTime timestamp;
    private String method;
    private String path;
    private Map<String, String> headers;
    private byte[] body;

    // Constructors
    public RequestContext() {}

    public RequestContext(UUID requestId, LocalDateTime timestamp, String method, String path,
                         Map<String, String> headers, byte[] body) {
        this.requestId = requestId;
        this.timestamp = timestamp;
        this.method = method;
        this.path = path;
        this.headers = headers;
        this.body = body;
    }

    // Getters and Setters
    public UUID getRequestId() { return requestId; }
    public void setRequestId(UUID requestId) { this.requestId = requestId; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }

    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }

    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }

    public Map<String, String> getHeaders() { return headers; }
    public void setHeaders(Map<String, String> headers) { this.headers = headers; }

    public byte[] getBody() { return body; }
    public void setBody(byte[] body) { this.body = body; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RequestContext)) return false;
        RequestContext that = (RequestContext) o;
        return Objects.equals(requestId, that.requestId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(requestId);
    }
}
```

### ResponseContext.java
```java
package com.example.proxy.domain.entities;

import java.util.UUID;
import java.util.Map;
import java.util.Objects;

public class ResponseContext {
    private UUID requestId;
    private Integer statusCode;
    private Map<String, String> headers;
    private byte[] body;
    private Integer latencyMs;

    // Constructors
    public ResponseContext() {}

    public ResponseContext(UUID requestId, Integer statusCode, Map<String, String> headers,
                          byte[] body, Integer latencyMs) {
        this.requestId = requestId;
        this.statusCode = statusCode;
        this.headers = headers;
        this.body = body;
        this.latencyMs = latencyMs;
    }

    // Getters and Setters
    public UUID getRequestId() { return requestId; }
    public void setRequestId(UUID requestId) { this.requestId = requestId; }

    public Integer getStatusCode() { return statusCode; }
    public void setStatusCode(Integer statusCode) { this.statusCode = statusCode; }

    public Map<String, String> getHeaders() { return headers; }
    public void setHeaders(Map<String, String> headers) { this.headers = headers; }

    public byte[] getBody() { return body; }
    public void setBody(byte[] body) { this.body = body; }

    public Integer getLatencyMs() { return latencyMs; }
    public void setLatencyMs(Integer latencyMs) { this.latencyMs = latencyMs; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ResponseContext)) return false;
        ResponseContext that = (ResponseContext) o;
        return Objects.equals(requestId, that.requestId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(requestId);
    }
}
```

### WebhookSubscription.java
```java
package com.example.proxy.domain.entities;

import java.util.UUID;
import java.util.List;
import java.util.Objects;

public class WebhookSubscription {
    private UUID id;
    private String targetUrl;
    private List<String> eventTypes;
    private String secret;
    private Boolean active;

    // Constructors
    public WebhookSubscription() {}

    public WebhookSubscription(UUID id, String targetUrl, List<String> eventTypes,
                              String secret, Boolean active) {
        this.id = id;
        this.targetUrl = targetUrl;
        this.eventTypes = eventTypes;
        this.secret = secret;
        this.active = active;
    }

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

   