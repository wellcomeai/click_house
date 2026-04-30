import uuid
from functools import lru_cache

import boto3

from config import settings


@lru_cache
def _get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
    )


async def upload_file(
    file_bytes: bytes,
    original_name: str,
    content_type: str,
    folder: str,
) -> dict:
    unique_name = f"{uuid.uuid4()}_{original_name}"
    storage_key = f"{folder}/{unique_name}"

    s3 = _get_s3_client()
    s3.put_object(
        Bucket=settings.r2_bucket_name,
        Key=storage_key,
        Body=file_bytes,
        ContentType=content_type,
    )

    public_url = f"{settings.r2_public_url.rstrip('/')}/{storage_key}"
    return {"storage_key": storage_key, "public_url": public_url}


async def delete_file(storage_key: str) -> None:
    s3 = _get_s3_client()
    s3.delete_object(Bucket=settings.r2_bucket_name, Key=storage_key)
