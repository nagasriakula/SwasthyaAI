"""
Who can see which patient (ANM -> ASHA hierarchy).

- ADMIN: every patient.
- ANM:   patients registered by the ASHA workers she supervises
         (users.anm_id == ANM id), plus any patient she registered herself.
- ASHA:  only the patients she registered.

Screenings, results, follow-ups, dashboards and health cards all follow the
patient, so every router uses these helpers instead of its own rule.
"""
from sqlalchemy import or_, select, true

from app.models.patient import Patient
from app.models.user import User


def visible_patient_ids(user: User):
    """Subquery of patient ids the user may see, or None for full access."""
    if user.role == "ADMIN":
        return None

    if user.role == "ANM":
        my_ashas = select(User.id).where(User.anm_id == user.id)
        return select(Patient.id).where(
            or_(
                Patient.registered_by.in_(my_ashas),
                Patient.registered_by == user.id,
            )
        )

    return select(Patient.id).where(Patient.registered_by == user.id)


def patient_filter(user: User):
    """WHERE clause on Patient for list queries."""
    ids = visible_patient_ids(user)
    return true() if ids is None else Patient.id.in_(ids)


def patient_id_filter(user: User, column):
    """WHERE clause for any table with a patient_id column."""
    ids = visible_patient_ids(user)
    return true() if ids is None else column.in_(ids)


def can_access_patient(db, user: User, patient: Patient) -> bool:
    if user.role == "ADMIN":
        return True

    if patient.registered_by == user.id:
        return True

    if user.role == "ANM":
        owner = db.get(User, patient.registered_by)
        return owner is not None and owner.anm_id == user.id

    return False
