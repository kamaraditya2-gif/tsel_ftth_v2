/**
 * Circuit Breaker Pattern Implementation
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failure threshold reached, requests fail fast
 * - HALF_OPEN: After timeout, allow test request to check if service recovered
 */

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.timeoutDuration = options.timeoutDuration || 30000; // 30 seconds
    this.successThreshold = options.successThreshold || 2;
    
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = Date.now();
    
    console.log(`🔒 Circuit Breaker '${name}' initialized: threshold=${this.failureThreshold}, timeout=${this.timeoutDuration}ms`);
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        console.log(`⚠️  Circuit Breaker '${this.name}' is OPEN - failing fast`);
        throw new Error(`Circuit breaker '${this.name}' is OPEN`);
      }
      // Transition to HALF_OPEN
      this.state = 'HALF_OPEN';
      console.log(`🔓 Circuit Breaker '${this.name}' transitioning to HALF_OPEN`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        console.log(`✅ Circuit Breaker '${this.name}' CLOSED - service recovered`);
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      console.log(`🚨 Circuit Breaker '${this.name}' OPENED after ${this.failureCount} failures`);
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeoutDuration;
    }
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Create circuit breakers for different services
const circuitBreakers = {
  axiros: new CircuitBreaker('axiros-api', {
    failureThreshold: 5,
    timeoutDuration: 30000,
    successThreshold: 2
  }),
  testServer: new CircuitBreaker('test-server-api', {
    failureThreshold: 3,
    timeoutDuration: 15000,
    successThreshold: 1
  })
};

module.exports = { CircuitBreaker, circuitBreakers };
