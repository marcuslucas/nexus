from datetime import datetime, timezone

from flask import Blueprint, jsonify

bp = Blueprint('web_manager_ping', __name__)


def _response(data=None, error=None, status=200):
    return jsonify({
        'data': data,
        'error': error,
        'timestamp': datetime.now(timezone.utc).isoformat(),
    }), status


@bp.route('/api/web-manager/ping', methods=['GET'])
def ping():
    return _response(data={'module': 'web-manager', 'status': 'ok'})
