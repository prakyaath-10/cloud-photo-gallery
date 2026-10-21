import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({});
const TABLE = process.env.TABLE_NAME || 'photos';

export const handler = async (event) => {
  try {
    const { userId, key, caption, size } = JSON.parse(event.body || '{}');

    const item = {
      userId: { S: userId },
      photoId: { S: key },
      caption: { S: caption || '' },
      size: { N: String(size || 0) },
      uploadedAt: { N: String(Date.now()) },
    };

    await ddb.send(new PutItemCommand({ TableName: TABLE, Item: item }));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST',
      },
      body: JSON.stringify({ ok: true }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};