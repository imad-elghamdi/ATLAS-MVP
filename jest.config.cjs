module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/test/**/*.test.ts"],
  moduleNameMapper: {
    "^(.*)\.json$": "$1.json"
  }
};
