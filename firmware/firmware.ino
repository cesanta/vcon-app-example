void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  // Handle serial input: switch LED on/off
  if (Serial.available() > 0) {
    int ch = Serial.read();
    if (ch == '0') digitalWrite(LED_BUILTIN, LOW);   // '0' switches LED off
    if (ch == '1') digitalWrite(LED_BUILTIN, HIGH);  // '1' switches LED on
  }

  // Print current status to serial every 5 seconds
  // A status message is a JSON string like this: {"led": 0, "sensor": 27}
  static unsigned long prev;
  unsigned long curr = millis();
  if (curr - prev > 5000) {
    char buf[100];
    snprintf(buf, sizeof(buf), "{\"led\": %d, \"sensor\": %d}",
             (int) digitalRead(LED_BUILTIN), (int) random(20, 30));
    Serial.println(buf);
    prev = curr;
  }
}
