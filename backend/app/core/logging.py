import logging
import sys
from datetime import datetime


def setup_logging():
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter("[%(asctime)s] %(levelname)s %(name)s: %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
    )
    logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)
    return logging.getLogger("dr_screening")


logger = setup_logging()
