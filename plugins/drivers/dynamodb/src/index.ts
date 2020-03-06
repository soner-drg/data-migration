import * as AWS from "aws-sdk";
import { DriverBuilder, NoSqlDriver, Logger } from "data-migration";
import { Observable } from "rxjs";

interface DynamoDbParameters {
  region: string;
  TableName: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
}

export type DynamoDbDriver = NoSqlDriver<DynamoDbParameters, AWS.DynamoDB.DocumentClient>;

const dynamoDbDriver: DriverBuilder<DynamoDbParameters, DynamoDbDriver> = (
  params,
  logger: Logger
): DynamoDbDriver => {
  const { TableName } = params;
  const DocumentDb = new AWS.DynamoDB.DocumentClient({
    region: params.region,
    apiVersion: "2012-08-10",
    accessKeyId: params.accessKeyId,
    secretAccessKey: params.secretAccessKey,
    endpoint: params.endpoint,
  });

  return {
    parameters: params,
    resource: DocumentDb,

    /**
     * Gets every record in the table
     */
    getAllRecords<T>(): Observable<T> {
      // @ts-ignore
      return new Observable<T>(async (subscriber) => {
        const params = {
          TableName,
        } as AWS.DynamoDB.DocumentClient.ScanInput;

        let resultsRaw: AWS.DynamoDB.DocumentClient.ScanOutput;

        do {
          resultsRaw = await DocumentDb.scan(params).promise();
          logger(`Downloaded ${resultsRaw.Count} records from ${TableName}`);
          params.ExclusiveStartKey = resultsRaw.LastEvaluatedKey;

          if (resultsRaw.Items) {
            for (const item of resultsRaw.Items) {
              subscriber.next(item as T);
            }
          }
        } while (resultsRaw?.LastEvaluatedKey);

        subscriber.complete();
      });
    },
    async putRecord<T>(record: T): Promise<T> {
      logger(`Writing ${JSON.stringify(record)} to ${TableName}`);
      const result = await DocumentDb.put({
        ReturnConsumedCapacity: "INDEXES",
        TableName,
        Item: record,
      }).promise();

      logger(`Used ${result.ConsumedCapacity?.WriteCapacityUnits} Write capacity units`);

      return result.Attributes as T;
    },
    async putRecordsBulk<T>(records: Array<T>): Promise<Array<T>> {
      logger(`Writing ${records.length} entries to ${TableName}`);

      const params = {
        ReturnConsumedCapacity: "INDEXES",
        RequestItems: {},
      } as AWS.DynamoDB.DocumentClient.BatchWriteItemInput;

      for (let startIdx = 0; startIdx < records.length; startIdx += 25) {
        params.RequestItems[TableName] = records
          .slice(startIdx, Math.min(startIdx + 25, records.length))
          .map(
            (record) =>
              ({
                PutRequest: {
                  Item: record,
                },
              } as AWS.DynamoDB.DocumentClient.WriteRequest)
          );

        const result = await DocumentDb.batchWrite(params).promise();
        logger(
          `Used ${result.ConsumedCapacity?.reduce(
            (total, next) => total + (next.WriteCapacityUnits || 0),
            0
          )}`
        );

        if (result.UnprocessedItems?.[TableName]?.length) {
          logger(
            `Error writing items to ${TableName}: ${JSON.stringify(
              result.UnprocessedItems[TableName]
            )}`
          );
        }
      }

      return records;
    },
  } as DynamoDbDriver;
};

export default dynamoDbDriver;
