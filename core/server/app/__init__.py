import logging

from flask import Flask

from .config import Config
from .routes.health import bp as health_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    logging.basicConfig(level=logging.INFO)
    app.logger.info(f"NEXUS_PRODUCT={app.config['NEXUS_PRODUCT']}")

    app.register_blueprint(health_bp)

    # Phase 2+: module blueprints will be registered here based on product.json

    return app
