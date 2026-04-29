"""Creates the admin user if it doesn't already exist."""
import asyncio
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select

from config import settings
from database import AsyncSessionLocal
from modules.users.models import User, UserProfile, UserRole

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def create_admin() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == settings.admin_email))
        existing = result.scalar_one_or_none()

        if existing:
            logger.info("Admin user already exists: %s", settings.admin_email)
            return

        from passlib.context import CryptContext

        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

        user = User(
            email=settings.admin_email,
            hashed_password=pwd_context.hash(settings.admin_password),
            role=UserRole.admin,
            is_active=True,
        )
        db.add(user)
        await db.flush()

        profile = UserProfile(
            user_id=user.id,
            first_name="Администратор",
        )
        db.add(profile)
        await db.commit()
        logger.info("Admin user created: %s", settings.admin_email)


if __name__ == "__main__":
    asyncio.run(create_admin())
