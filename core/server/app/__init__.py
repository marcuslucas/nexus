import importlib
import json
import logging
import sqlite3
from pathlib import Path

from flask import Flask

from .config import Config
from .routes.health import bp as health_bp

# Project root: nexus/
_PROJECT_ROOT = Path(__file__).parent.parent.parent.parent


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    logging.basicConfig(level=logging.INFO)
    app.logger.info(f"NEXUS_PRODUCT={app.config['NEXUS_PRODUCT']}")

    app.register_blueprint(health_bp)
    _load_modules(app)

    return app


def _load_modules(app: Flask) -> None:
    product = app.config['NEXUS_PRODUCT']
    if product == 'unknown':
        app.logger.warning('NEXUS_PRODUCT not set — starting with zero modules')
        return

    product_json = _PROJECT_ROOT / 'products' / product / 'product.json'
    if not product_json.exists():
        app.logger.warning(f'product.json not found for product "{product}" — starting with zero modules')
        return

    with open(product_json) as f:
        product_config = json.load(f)

    module_ids = product_config.get('modules', [])
    app.logger.info(f'Loading modules: {module_ids}')

    for module_id in module_ids:
        _load_module(app, module_id)


def _load_module(app: Flask, module_id: str) -> None:
    module_dir = module_id.replace('-', '_')
    manifest_path = _PROJECT_ROOT / 'modules' / module_dir / 'manifest.json'

    if not manifest_path.exists():
        app.logger.error(f'[{module_id}] manifest.json not found at {manifest_path} — skipping')
        return

    with open(manifest_path) as f:
        manifest = json.load(f)

    # Register Flask blueprints
    for blueprint_path in manifest.get('server', {}).get('blueprints', []):
        try:
            mod = importlib.import_module(blueprint_path)
            app.register_blueprint(mod.bp)
            app.logger.info(f'[{module_id}] Registered blueprint: {blueprint_path}')
        except Exception as e:
            app.logger.error(f'[{module_id}] Failed to register blueprint {blueprint_path}: {e}')

    # Apply db schema if the env key is set and resolves to a path
    server_cfg = manifest.get('server', {})
    db_env_key = server_cfg.get('db_env_key')
    db_schema = server_cfg.get('db_schema')

    if db_env_key and db_schema:
        db_path = app.config.get(db_env_key)
        if db_path:
            _apply_schema(app, module_id, db_path, db_schema)
        else:
            app.logger.info(f'[{module_id}] {db_env_key} not set — skipping schema application')


def _apply_schema(app: Flask, module_id: str, db_path: str, schema_relative: str) -> None:
    schema_file = _PROJECT_ROOT / schema_relative
    if not schema_file.exists():
        app.logger.error(f'[{module_id}] Schema file not found: {schema_file}')
        return

    sql = schema_file.read_text()
    if not sql.strip():
        return  # Empty schema (stub) — nothing to apply

    try:
        path = Path(db_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(path))
        conn.executescript(sql)
        conn.close()
        app.logger.info(f'[{module_id}] Schema applied to {db_path}')
    except Exception as e:
        app.logger.error(f'[{module_id}] Failed to apply schema: {e}')
