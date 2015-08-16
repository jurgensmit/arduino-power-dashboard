#include <ESP8266.h>
#include <SoftwareSerial.h>
#include <TimerOne.h>
#include "confidential.h"

#define HOST_PORT   80

#define REFLECTION_THRESHOLD_HIGH 130
#define REFLECTION_THRESHOLD_LOW 110
#define SAMPLE_FREQUENCY 100
#define RUNNING_AVERAGE_SAMPLES 10
#define UPLOAD_INTERVAL 10

#define STATUS_LED_PIN LED_BUILTIN
#define ESP_RESET_PIN 6
#define ERROR_LED_PIN 7
#define TCRT5000_PIN 0
  
SoftwareSerial softSerial(4, 5);    // RX, TX
ESP8266 wifi(softSerial);

long pulseCount = 0;
long errorCount = 0;

int runningAverageBuffer[RUNNING_AVERAGE_SAMPLES];
int runningAverageIndex = 0;

void setup() {
  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(ERROR_LED_PIN, OUTPUT);
  pinMode(ESP_RESET_PIN, OUTPUT);
  
  Serial.begin(9600);
  while (!Serial) {
  }

  // Initialize the running average buffer
  for(int i = 0; i < RUNNING_AVERAGE_SAMPLES; i ++) {
    runningAverageBuffer[i] = -1;
  }

  // Start counting pulses 
  Timer1.initialize(1000000L / SAMPLE_FREQUENCY);
  Timer1.attachInterrupt(detectPulse); 
  
  softSerial.begin(2400);

  Serial.println(F("Arduino Electricity Monitor"));
  Serial.println();

  while(initESP8266()) {
  }

  Serial.println(F("Ready"));
  Serial.println();

  delay(1000);
}

int calculateRunningAverage(int values[], int n) {
  int runningAverage = -1;
  
  int sum = 0;
  int numberOfValues = 0;
  for(int i = 0; i < n; i ++) {
    if(values[i] >= 50 && values[i] < 200) {
      sum += values[i];
      numberOfValues++;      
    }
  }
  
  if(numberOfValues > 0) {
    runningAverage = sum / numberOfValues;
  }

  return runningAverage;
}

/*
 * Return true when a reflective material is detected, false if not
 */
bool previousReflectorState = true;

int minRunningAverage = 200;
int maxRunningAverage = 0;

bool getReflectorState() {
  int tcrt5000Value = analogRead(TCRT5000_PIN);

  runningAverageBuffer[runningAverageIndex] = tcrt5000Value;
  runningAverageIndex = (runningAverageIndex + 1) % RUNNING_AVERAGE_SAMPLES;

  int runningAverage = calculateRunningAverage(runningAverageBuffer, RUNNING_AVERAGE_SAMPLES);

  bool reflectorState = previousReflectorState;
  if(runningAverage > 0) {
    int threshold = previousReflectorState ? REFLECTION_THRESHOLD_HIGH : REFLECTION_THRESHOLD_LOW;
  
    reflectorState = runningAverage < threshold;
  
    minRunningAverage = min(minRunningAverage, runningAverage);
    maxRunningAverage = max(maxRunningAverage, runningAverage);
  }
  
  if(reflectorState != previousReflectorState) {
    minRunningAverage = 200;
    maxRunningAverage = 0;
  }

  previousReflectorState = reflectorState;
  return reflectorState;
}

bool pulseLowDetected = false;
int rs = 200;
int re = 0;
int lrs = 0;
int lre = 0;

void detectPulse() {
  bool reflectorState = getReflectorState();

  int runningAverage = calculateRunningAverage(runningAverageBuffer, RUNNING_AVERAGE_SAMPLES);
  if(runningAverage > 0) {
    rs = min(rs, runningAverage);
    re = max(re, runningAverage);
  }

  if(pulseLowDetected) {  // currently black detected
    if(reflectorState) {
      // reflective material again after black, count a pulse
      //Serial.print(F("Reflective material detected: "));
      //Serial.println(String(runningAverage))  ;
      pulseLowDetected = false;      
      pulseCount += 1;  
      lrs = rs;
      lre = re;
      rs = 200;
      re = 0;
    }
  }
  else {  // not yet black detected
    if(!reflectorState) {
      // black detected
      //Serial.print(F("Black detected: "));
      //Serial.println(String(runningAverage));
      pulseLowDetected = true;
    }
  }
}

int initESP8266() {
  Serial.println(F("Initialize ESP8266 WiFi Module"));

  int error = 0;
  
  resetESP8266();

  if(!wifi.kick()) {
    Serial.print(F("Waiting for the WiFi module"));
    while(!wifi.kick()) {
      Serial.print(F("."));
      resetESP8266();
    }
    Serial.println();
  }

  Serial.println(wifi.getVersion());
  
  if(!wifi.setOprToStation()) {
    Serial.println(F("Unable to set station only mode!"));
    error = 1;
  }

  if(!error && wifi.joinAP(SSID, PASSWORD)) {
    Serial.print(F("IP:"));
    Serial.println(wifi.getStationIp());       
  } 
  else {
    Serial.println(F("Unable to join access point!"));
    error = 2;
  }
    
  if(!wifi.disableMUX()) {
    Serial.println(F("Unable to disable MUX!"));
    error = 3;
  }

  if(!error) {
    delay(1000);
  }

  return error;
}

void resetESP8266() {
  digitalWrite(ESP_RESET_PIN, LOW);
  delay(500);
  digitalWrite(ESP_RESET_PIN, HIGH);
  delay(4500);
}

int sendPulseCount(long pulseCount, long errorCount, long loopCount, int rangeStart, int rangeEnd) {
  int error = 0;
  
  if(wifi.createTCP(HOST_NAME, HOST_PORT)) {
    String body = "{\"pc\": " + String(pulseCount) + "," + "\"ec\": " + String(errorCount) + "," + "\"lc\": " + String(loopCount) + "," + "\"rs\": " + String(rangeStart) + "," + "\"re\": " + String(rangeEnd) + "}";
    String request = "POST http://" + String(HOST_NAME) + "/tables/electricity HTTP/1.1\r\nHost: " + String(HOST_NAME) + "\r\nX-ZUMO-APPLICATION: " + String(APPLICATION_KEY) + "\r\nContent-Type: application/json\r\nContent-Length: " + String(body.length()) + "\r\n\r\n" + body;
    if(!wifi.send((const uint8_t*)request.c_str(), request.length())) {
      error = 1;
      Serial.print(F("Unable to post request"));
      //Serial.println(request);
    }
  }
  else {
    error = 2;
    Serial.print(F("Unable to create TCP connection"));
  }

  return error;
}

long noPulseDetectedCount = 0;
long loopCount = 0;
bool firstTime = true;

void loop() {
  noInterrupts();
  long pulseCountToSent = pulseCount;
  interrupts();

  if(pulseCountToSent > 0) {
    if(loopCount >= UPLOAD_INTERVAL || firstTime) {
      Serial.print(F("Posting new values: ")); Serial.print(String(pulseCountToSent)); Serial.print(F(", "));
      Serial.print(String(errorCount)); Serial.print(F(", ")); Serial.print(String(loopCount)); Serial.print(F(", "));
      Serial.print(String(lrs));  Serial.print(F(", ")); Serial.print(String(lre)); Serial.print(F(" "));
  
      if(!sendPulseCount(pulseCountToSent, errorCount, loopCount, lrs, lre)) {
        noInterrupts();
        pulseCount -= pulseCountToSent;
        interrupts();
        errorCount = 0;
        Serial.print(F("done"));
      }
      else {
        errorCount += 1;    
      }
      Serial.println();
      noPulseDetectedCount = 0;
      loopCount = 0;
      firstTime = false;

      if(errorCount > 11) {
        while(initESP8266()) {
        }
      }  
      else if(errorCount > 0 && errorCount % 3 == 0) {
        resetESP8266();
      }
    }
  }
  else {
    noPulseDetectedCount += 1;
  }

  if(noPulseDetectedCount > 3600) {
    // It has been longer than 60 minutes since no pulse has been detected
    if(!sendPulseCount(0, errorCount, noPulseDetectedCount, lrs, lre)) {
      noPulseDetectedCount = 0;
    }
  }
  
  digitalWrite(ERROR_LED_PIN, errorCount > 0 ? HIGH : LOW);
  digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
  delay(1000);

  loopCount += 1;
}
