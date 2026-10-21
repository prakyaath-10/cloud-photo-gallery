import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({});
const TABLE = process.env.TABLE_NAME || 'photos';

export const handler = async (event) => {
  try {
    const userId = event.queryStringParameters?.userId || 'demo-user-1';

    const command = new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: {
        ':uid': { S: userId },
      },
    });

    const response = await ddb.send(command);
    const photos = (response.Items || []).map((item) => ({
      photoId: item.photoId.S,
      caption: item.caption.S,
      size: Number(item.size.N),
      uploadedAt: Number(item.uploadedAt.N),
    }));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,GET',
      },
      body: JSON.stringify({ photos }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};