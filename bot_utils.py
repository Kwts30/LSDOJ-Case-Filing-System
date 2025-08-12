import os
import logging
import sys
from io import BytesIO
import discord
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get Discord configuration
DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
BIRTH_CHANNEL_ID = int(os.getenv("BIRTH_CHANNEL_ID", "0"))
MARRIAGE_CHANNEL_ID = int(os.getenv("MARRIAGE_CHANNEL_ID", "0"))
BUSINESS_CHANNEL_ID = int(os.getenv("BUSINESS_CHANNEL_ID", "0"))  # New channel for business permits

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('discord_bot.log')
    ]
)
logger = logging.getLogger(__name__)

# Initialize Discord client
client = discord.Client(intents=discord.Intents.default())

@client.event
async def on_ready():
    """Called when the bot is ready."""
    logger.info(f"Bot is ready and logged in as {client.user}")

async def send_certificate(
    img_bytes: bytes,
    name: str,
    state: str,
    city: str,
    state_file_num: str,
    local_reg_num: str,
    certificate_type: str = "birth",
    is_marriage: bool = False  # kept for backward compatibility
) -> bool:
    """
    Send a certificate to the appropriate Discord channel.
    
    Args:
        img_bytes: The image bytes to send
        name: The name on the certificate
        state: The state of issue
        city: The city of issue
        state_file_num: The state file number
        local_reg_num: The local registration number
        is_marriage: Whether this is a marriage certificate
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Determine channel based on certificate type
        if certificate_type == "marriage" or is_marriage:
            channel_id = MARRIAGE_CHANNEL_ID
        elif certificate_type == "business":
            channel_id = BUSINESS_CHANNEL_ID
        else:
            channel_id = BIRTH_CHANNEL_ID
        channel = client.get_channel(channel_id)
        
        if not channel:
            logger.error(f"Could not find channel with ID {channel_id}")
            return False
            
        # Create the file from bytes
        file = discord.File(
            BytesIO(img_bytes),
            filename=f"{name}_{state}_{city}.png"
        )
        
        # Create the message content
        # Human readable type
        readable_type = certificate_type.replace("_", " ").title()

        content = (
            f"New {readable_type} Submission\n"
            f"Name / Business: {name}\n"
            f"Location: {city}, {state}\n"
            f"State File #: {state_file_num or 'N/A'}\n"
            f"Local Reg / Permit #: {local_reg_num or 'N/A'}"
        )
        
        # Send the message
        await channel.send(content=content, file=file)
        logger.info(f"Successfully sent certificate for {name}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send certificate: {str(e)}")
        return False

def start_bot():
    """Start the Discord bot."""
    if not DISCORD_TOKEN:
        raise ValueError("DISCORD_TOKEN environment variable is not set")
        
    try:
        client.run(DISCORD_TOKEN)
    except Exception as e:
        logger.error(f"Failed to start bot: {str(e)}")
        raise
