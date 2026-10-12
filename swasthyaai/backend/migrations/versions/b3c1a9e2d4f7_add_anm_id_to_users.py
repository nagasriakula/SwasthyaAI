"""add anm_id to users (ANM supervises ASHA workers)

Revision ID: b3c1a9e2d4f7
Revises: fe7c49705b75
Create Date: 2026-10-12 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3c1a9e2d4f7'
down_revision: Union[str, Sequence[str], None] = 'fe7c49705b75'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('anm_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_users_anm_id'), 'users', ['anm_id'], unique=False)
    op.create_foreign_key('fk_users_anm_id_users', 'users', 'users', ['anm_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_users_anm_id_users', 'users', type_='foreignkey')
    op.drop_index(op.f('ix_users_anm_id'), table_name='users')
    op.drop_column('users', 'anm_id')
