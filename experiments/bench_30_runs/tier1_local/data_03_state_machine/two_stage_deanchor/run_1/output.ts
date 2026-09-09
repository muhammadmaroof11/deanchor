# Production-Grade Greenfield Implementation

## Architecture Overview

This implementation follows a clean, modular architecture with clear separation of concerns. The system is built around three core layers:

1. **Domain Layer**: Contains all business logic and entities
2. **Service Layer**: Orchestrates domain operations and enforces invariants
3. **API Layer**: Provides external interfaces for interaction

## File Structure

```
src/
├── main/
│   ├── java/
│   │   └── com/
│   │       └── example/
│   │           └── stateflow/
│   │               ├── domain/
│   │               │   ├── StateMachine.java
│   │               │   ├── StateTransition.java
│   │               │   ├── DataRecord.java
│   │               │   └── exceptions/
│   │               │       ├── InvalidTransitionException.java
│   │               │       ├── RecordNotFoundException.java
│   │               │       └── VersionMismatchException.java
│   │               ├── service/
│   │               │   ├── StateMachineService.java
│   │               │   ├── DataRecordService.java
│   │               │   └── TransitionValidator.java
│   │               ├── repository/
│   │               │   └── DataRepository.java
│   │               ├── api/
│   │               │   ├── StateMachineController.java
│   │               │   └── DataRecordController.java
│   │               └── config/
│   │                   └── ApplicationConfig.java
│   └── resources/
│       ├── application.yml
│       └── logback-spring.xml
└── test/
    └── java/
        └── com/
            └── example/
                └── stateflow/
                    ├── domain/
                    │   ├── StateMachineTest.java
                    │   ├── DataRecordTest.java
                    │   └── StateTransitionTest.java
                    ├── service/
                    │   ├── StateMachineServiceTest.java
                    │   └── DataRecordServiceTest.java
                    └── integration/
                        └── StateFlowIntegrationTest.java
```

## Core Implementation

### 1. Domain Entities

```java
// src/main/java/com/example/stateflow/domain/StateMachine.java
package com.example.stateflow.domain;

import java.util.List;
import java.util.Objects;

public class StateMachine {
    private String current_state;
    private List<String> states;
    private List<StateTransition> transitions;
    
    // Constructors
    public StateMachine() {}
    
    public StateMachine(String currentState, List<String> states, List<StateTransition> transitions) {
        this.current_state = currentState;
        this.states = states;
        this.transitions = transitions;
    }
    
    // Getters and Setters
    public String getCurrentState() { return current_state; }
    public void setCurrentState(String current_state) { this.current_state = current_state; }
    
    public List<String> getStates() { return states; }
    public void setStates(List<String> states) { this.states = states; }
    
    public List<StateTransition> getTransitions() { return transitions; }
    public void setTransitions(List<StateTransition> transitions) { this.transitions = transitions; }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof StateMachine)) return false;
        StateMachine that = (StateMachine) o;
        return Objects.equals(current_state, that.current_state) &&
               Objects.equals(states, that.states) &&
               Objects.equals(transitions, that.transitions);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(current_state, states, transitions);
    }
}
```

```java
// src/main/java/com/example/stateflow/domain/StateTransition.java
package com.example.stateflow.domain;

import java.util.Objects;

public class StateTransition {
    private String from_state;
    private String to_state;
    private String trigger_event;
    private String guard_condition;
    
    // Constructors
    public StateTransition() {}
    
    public StateTransition(String fromState, String toState, String triggerEvent, String guardCondition) {
        this.from_state = fromState;
        this.to_state = toState;
        this.trigger_event = triggerEvent;
        this.guard_condition = guardCondition;
    }
    
    // Getters and Setters
    public String getFromState() { return from_state; }
    public void setFromState(String from_state) { this.from_state = from_state; }
    
    public String getToState() { return to_state; }
    public void setToState(String to_state) { this.to_state = to_state; }
    
    public String getTriggerEvent() { return trigger_event; }
    public void setTriggerEvent(String trigger_event) { this.trigger_event = trigger_event; }
    
    public String getGuardCondition() { return guard_condition; }
    public void setGuardCondition(String guard_condition) { this.guard_condition = guard_condition; }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof StateTransition)) return false;
        StateTransition that = (StateTransition) o;
        return Objects.equals(from_state, that.from_state) &&
               Objects.equals(to_state, that.to_state) &&
               Objects.equals(trigger_event, that.trigger_event) &&
               Objects.equals(guard_condition, that.guard_condition);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(from_state, to_state, trigger_event, guard_condition);
    }
}
```

```java
// src/main/java/com/example/stateflow/domain/DataRecord.java
package com.example.stateflow.domain;

import java.util.Objects;
import java.util.Map;

public class DataRecord {
    private String id;
    private Map<String, Object> data;
    private Map<String, Object> metadata;
    private Integer version;
    
    // Constructors
    public DataRecord() {}
    
    public DataRecord(String id, Map<String, Object> data, Map<String, Object> metadata, Integer version) {
        this.id = id;
        this.data = data;
        this.metadata = metadata;
        this.version = version;
    }
    
    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public Map<String, Object> getData() { return data; }
    public void setData(Map<String, Object> data) { this.data = data; }
    
    public Map<String, Object> getMetadata() { return metadata; }
    public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata; }
    
    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof DataRecord)) return false;
        DataRecord that = (DataRecord) o;
        return Objects.equals(id, that.id) &&
               Objects.equals(data, that.data) &&
               Objects.equals(metadata, that.metadata) &&
               Objects.equals(version, that.version);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(id, data, metadata, version);
    }
}
```

### 2. Exception Handling

```java
// src/main/java/com/example/stateflow/domain/exceptions/InvalidTransitionException.java
package com.example.stateflow.domain.exceptions;

public class InvalidTransitionException extends RuntimeException {
    public InvalidTransitionException(String message) {
        super(message);
    }
    
    public InvalidTransitionException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

```java
// src/main/java/com/example/stateflow/domain/exceptions/RecordNotFoundException.java
package com.example.stateflow.domain.exceptions;

public class RecordNotFoundException extends RuntimeException {
    public RecordNotFoundException(String message) {
        super(message);
    }
    
    public RecordNotFoundException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

```java
// src/main/java/com/example/stateflow/domain/exceptions/VersionMismatchException.java
package com.example.stateflow.domain.exceptions;

public class VersionMismatchException extends RuntimeException {
    public VersionMismatchException(String message) {
        super(message);
    }
    
    public VersionMismatchException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

### 3. Service Layer

```java
// src/main/java/com/example/stateflow/service/TransitionValidator.java
package com.example.stateflow.service;

import com.example.stateflow.domain.StateMachine;
import com.example.stateflow.domain.StateTransition;
import com.example.stateflow.domain.exceptions.InvalidTransitionException;
import java.util.Optional;

public class TransitionValidator {
    
    public static boolean validateTransition(StateMachine stateMachine, String event, String currentState) {
        // Invariant: "event_must_be_defined_in_transitions"
        Optional<StateTransition> transition = findTransitionByEvent(stateMachine.getTransitions(), event);
        
        if (!transition.isPresent()) {
            throw new InvalidTransitionException("Event '" + event + "' is not defined in transitions");
        }
        
        StateTransition stateTransition = transition.get();
        
        // Invariant: "from_state_must_match_current_state"
        if (!stateTransition.getFromState().equals(currentState)) {
            throw new InvalidTransitionException(
                "Current state '" + currentState + 
                "' does not match expected from state '" + stateTransition.getFromState() + "'");
        }
        
        return true;
    }
    
    private static Optional<StateTransition> findTransitionByEvent(
            java.util.List<StateTransition> transitions, String event) {
        return transitions.stream()
                          .filter(t -> t.getTriggerEvent().equals(event