export default `module.exports = {
  defaultStage: "prod",
  migrationDirectory: "migrations",
  stages: {
    prod: {
      users: {
        driver: require("swallow-cognito"),
        params: {
          userPool: {
            processor: require("swallow-processor-cf"),
            params: {
              stack: "some-stack-name",
              output: "SomeOutputName",
              region: "us-east-1"
            }
          }
        }
      }
    }
  }
}
`;