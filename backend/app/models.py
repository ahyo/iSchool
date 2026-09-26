"""Model database iSchool (SQLAlchemy 2.0).

Nama tabel & kolom sama persis dengan tipe di frontend (src/lib/types.ts),
sehingga frontend dapat berpindah dari mode demo ke mode live tanpa perubahan kode.
"""
import datetime as dt

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base

FK = lambda target: ForeignKey(target, ondelete="SET NULL")  # noqa: E731


class Setting(Base):
    __tablename__ = "settings"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    foundation: Mapped[str] = mapped_column(String(200))
    address: Mapped[str] = mapped_column(Text, default="")
    phone: Mapped[str] = mapped_column(String(50), default="")
    email: Mapped[str] = mapped_column(String(120), default="")
    website: Mapped[str] = mapped_column(String(120), default="")
    vision: Mapped[str] = mapped_column(Text, default="")
    mission: Mapped[str] = mapped_column(Text, default="")
    ppdb_open: Mapped[bool] = mapped_column(Boolean, default=True)
    library_loan_days: Mapped[int] = mapped_column(Integer, default=7)
    library_max_loans: Mapped[int] = mapped_column(Integer, default=3)
    library_fine_per_day: Mapped[int] = mapped_column(Integer, default=500)


class Unit(Base):
    __tablename__ = "units"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(5))  # SD | SMP | SMA | SMK
    name: Mapped[str] = mapped_column(String(200))
    npsn: Mapped[str] = mapped_column(String(20), default="")
    accreditation: Mapped[str] = mapped_column(String(5), default="")
    address: Mapped[str] = mapped_column(Text, default="")
    head_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    min_grade: Mapped[int] = mapped_column(Integer)
    max_grade: Mapped[int] = mapped_column(Integer)


class AcademicYear(Base):
    __tablename__ = "academic_years"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(20))
    semester: Mapped[str] = mapped_column(String(10))
    start_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)


class Employee(Base):
    __tablename__ = "employees"
    id: Mapped[int] = mapped_column(primary_key=True)
    nip: Mapped[str] = mapped_column(String(40), index=True)
    name: Mapped[str] = mapped_column(String(150))
    gender: Mapped[str] = mapped_column(String(1), default="L")
    unit_id: Mapped[int | None] = mapped_column(FK("units.id"), nullable=True)
    type: Mapped[str] = mapped_column(String(20))  # guru | tendik | pimpinan
    position: Mapped[str] = mapped_column(String(120), default="")
    status: Mapped[str] = mapped_column(String(20), default="GTY")
    education: Mapped[str] = mapped_column(String(10), default="S1")
    phone: Mapped[str] = mapped_column(String(30), default="")
    email: Mapped[str] = mapped_column(String(120), default="")
    join_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    supervisor_id: Mapped[int | None] = mapped_column(FK("employees.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Guardian(Base):
    __tablename__ = "guardians"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    relation: Mapped[str] = mapped_column(String(30), default="Orang Tua")
    phone: Mapped[str] = mapped_column(String(30), default="")
    email: Mapped[str] = mapped_column(String(120), default="")
    occupation: Mapped[str] = mapped_column(String(80), default="")
    address: Mapped[str] = mapped_column(Text, default="")


class Major(Base):
    __tablename__ = "majors"
    id: Mapped[int] = mapped_column(primary_key=True)
    unit_id: Mapped[int] = mapped_column(ForeignKey("units.id", ondelete="CASCADE"))
    code: Mapped[str] = mapped_column(String(10))
    name: Mapped[str] = mapped_column(String(150))


class Subject(Base):
    __tablename__ = "subjects"
    id: Mapped[int] = mapped_column(primary_key=True)
    unit_id: Mapped[int] = mapped_column(ForeignKey("units.id", ondelete="CASCADE"))
    code: Mapped[str] = mapped_column(String(10))
    name: Mapped[str] = mapped_column(String(150))
    group: Mapped[str] = mapped_column(String(30), default="Umum")
    kkm: Mapped[int] = mapped_column(Integer, default=75)


class SchoolClass(Base):
    __tablename__ = "classes"
    id: Mapped[int] = mapped_column(primary_key=True)
    unit_id: Mapped[int] = mapped_column(ForeignKey("units.id", ondelete="CASCADE"))
    academic_year_id: Mapped[int] = mapped_column(ForeignKey("academic_years.id"))
    grade: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(40))
    major_id: Mapped[int | None] = mapped_column(FK("majors.id"), nullable=True)
    homeroom_id: Mapped[int | None] = mapped_column(FK("employees.id"), nullable=True)
    room: Mapped[str] = mapped_column(String(20), default="")
    capacity: Mapped[int] = mapped_column(Integer, default=32)


class Student(Base):
    __tablename__ = "students"
    id: Mapped[int] = mapped_column(primary_key=True)
    nis: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    nisn: Mapped[str] = mapped_column(String(20), default="")
    name: Mapped[str] = mapped_column(String(150), index=True)
    gender: Mapped[str] = mapped_column(String(1))
    birth_place: Mapped[str] = mapped_column(String(80), default="")
    birth_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    religion: Mapped[str] = mapped_column(String(20), default="Islam")
    address: Mapped[str] = mapped_column(Text, default="")
    class_id: Mapped[int | None] = mapped_column(FK("classes.id"), nullable=True, index=True)
    unit_id: Mapped[int] = mapped_column(ForeignKey("units.id"))
    guardian_id: Mapped[int | None] = mapped_column(FK("guardians.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(10), default="aktif")  # aktif | lulus | pindah | keluar
    entry_year: Mapped[int] = mapped_column(Integer)
    entry_type: Mapped[str] = mapped_column(String(10), default="baru")
    origin_school: Mapped[str] = mapped_column(String(150), default="")
    graduation_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    name: Mapped[str] = mapped_column(String(150))
    role: Mapped[str] = mapped_column(String(15))  # admin|kepsek|keuangan|kesiswaan|guru|siswa|ortu
    employee_id: Mapped[int | None] = mapped_column(FK("employees.id"), nullable=True)
    student_id: Mapped[int | None] = mapped_column(FK("students.id"), nullable=True)
    guardian_id: Mapped[int | None] = mapped_column(FK("guardians.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Schedule(Base):
    __tablename__ = "schedules"
    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), index=True)
    day: Mapped[int] = mapped_column(Integer)
    start_time: Mapped[str] = mapped_column(String(5))
    end_time: Mapped[str] = mapped_column(String(5))


class StudentAttendance(Base):
    __tablename__ = "student_attendance"
    __table_args__ = (UniqueConstraint("student_id", "date"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[dt.date] = mapped_column(Date, index=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"))
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(2))  # H | S | I | A
    note: Mapped[str] = mapped_column(String(200), default="")


class EmployeeAttendance(Base):
    __tablename__ = "employee_attendance"
    __table_args__ = (UniqueConstraint("employee_id", "date"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[dt.date] = mapped_column(Date, index=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"), index=True)
    check_in: Mapped[str | None] = mapped_column(String(5), nullable=True)
    check_out: Mapped[str | None] = mapped_column(String(5), nullable=True)
    status: Mapped[str] = mapped_column(String(2))  # H | S | I | A | DL
    note: Mapped[str] = mapped_column(String(200), default="")


class Material(Base):
    __tablename__ = "materials"
    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"))
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    content: Mapped[str] = mapped_column(Text, default="")
    link: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.now)


class Assignment(Base):
    __tablename__ = "assignments"
    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"))
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    due_date: Mapped[dt.date] = mapped_column(Date)
    max_score: Mapped[int] = mapped_column(Integer, default=100)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.now)


class Submission(Base):
    __tablename__ = "submissions"
    __table_args__ = (UniqueConstraint("assignment_id", "student_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    content: Mapped[str] = mapped_column(Text, default="")
    submitted_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.now)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    feedback: Mapped[str] = mapped_column(Text, default="")


class Exam(Base):
    __tablename__ = "exams"
    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"))
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    name: Mapped[str] = mapped_column(String(200))
    type: Mapped[str] = mapped_column(String(5))  # UH | PTS | PAS | PAT | US | UKK
    date: Mapped[dt.date] = mapped_column(Date)
    start_time: Mapped[str] = mapped_column(String(5), default="08:00")
    end_time: Mapped[str] = mapped_column(String(5), default="")  # jam ujian ditutup
    duration: Mapped[int] = mapped_column(Integer, default=60)
    is_online: Mapped[bool] = mapped_column(Boolean, default=True)
    questions: Mapped[list] = mapped_column(JSON, default=list)  # [{q, options[], answer}]


class ExamResult(Base):
    __tablename__ = "exam_results"
    __table_args__ = (UniqueConstraint("exam_id", "student_id", "kind"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    answers: Mapped[list] = mapped_column(JSON, default=list)
    score: Mapped[float] = mapped_column(Float)
    submitted_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.now)
    kind: Mapped[str] = mapped_column(String(10), default="utama")  # utama | susulan | remedial


class Grade(Base):
    __tablename__ = "grades"
    __table_args__ = (UniqueConstraint("student_id", "subject_id", "academic_year_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"))
    academic_year_id: Mapped[int] = mapped_column(ForeignKey("academic_years.id"))
    assignment: Mapped[float | None] = mapped_column(Float, nullable=True)
    daily: Mapped[float | None] = mapped_column(Float, nullable=True)
    midterm: Mapped[float | None] = mapped_column(Float, nullable=True)
    final_exam: Mapped[float | None] = mapped_column(Float, nullable=True)
    final: Mapped[float | None] = mapped_column(Float, nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")


class FeeType(Base):
    __tablename__ = "fee_types"
    id: Mapped[int] = mapped_column(primary_key=True)
    unit_id: Mapped[int | None] = mapped_column(FK("units.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(150))
    category: Mapped[str] = mapped_column(String(15))  # bulanan|pendaftaran|ujian|kegiatan|lainnya
    amount: Mapped[int] = mapped_column(Integer)
    description: Mapped[str] = mapped_column(Text, default="")


class Applicant(Base):
    __tablename__ = "applicants"
    id: Mapped[int] = mapped_column(primary_key=True)
    reg_no: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    type: Mapped[str] = mapped_column(String(10))  # baru | pindahan
    unit_id: Mapped[int] = mapped_column(ForeignKey("units.id"))
    grade_target: Mapped[int] = mapped_column(Integer)
    major_id: Mapped[int | None] = mapped_column(FK("majors.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(150))
    gender: Mapped[str] = mapped_column(String(1))
    birth_place: Mapped[str] = mapped_column(String(80), default="")
    birth_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    religion: Mapped[str] = mapped_column(String(20), default="Islam")
    nisn: Mapped[str] = mapped_column(String(20), default="")
    origin_school: Mapped[str] = mapped_column(String(150), default="")
    transfer_reason: Mapped[str] = mapped_column(Text, default="")
    address: Mapped[str] = mapped_column(Text, default="")
    parent_name: Mapped[str] = mapped_column(String(150), default="")
    parent_phone: Mapped[str] = mapped_column(String(30), default="")
    parent_email: Mapped[str] = mapped_column(String(120), default="")
    parent_occupation: Mapped[str] = mapped_column(String(80), default="")
    status: Mapped[str] = mapped_column(String(15), default="baru")
    test_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    student_id: Mapped[int | None] = mapped_column(FK("students.id"), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.now)


class Bill(Base):
    __tablename__ = "bills"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=True, index=True)
    applicant_id: Mapped[int | None] = mapped_column(ForeignKey("applicants.id", ondelete="CASCADE"), nullable=True)
    fee_type_id: Mapped[int] = mapped_column(ForeignKey("fee_types.id"))
    period: Mapped[str] = mapped_column(String(7), index=True)  # YYYY-MM
    description: Mapped[str] = mapped_column(String(250), default="")
    amount: Mapped[int] = mapped_column(Integer)
    discount: Mapped[int] = mapped_column(Integer, default=0)
    paid_amount: Mapped[int] = mapped_column(Integer, default=0)
    due_date: Mapped[dt.date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(10), default="belum")  # belum | sebagian | lunas
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.now)


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    bill_id: Mapped[int] = mapped_column(ForeignKey("bills.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int | None] = mapped_column(FK("students.id"), nullable=True, index=True)
    applicant_id: Mapped[int | None] = mapped_column(FK("applicants.id"), nullable=True)
    amount: Mapped[int] = mapped_column(Integer)
    method: Mapped[str] = mapped_column(String(20))
    receipt_no: Mapped[str | None] = mapped_column(String(30), unique=True, nullable=True)  # terbit saat diverifikasi
    paid_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.now, index=True)
    received_by: Mapped[str] = mapped_column(String(150), default="")
    note: Mapped[str] = mapped_column(String(250), default="")
    # Pembayaran online menunggu verifikasi bagian keuangan sebelum dihitung
    status: Mapped[str] = mapped_column(String(15), default="terverifikasi", index=True)  # menunggu | terverifikasi | ditolak
    reference: Mapped[str] = mapped_column(String(100), default="")
    proof_url: Mapped[str] = mapped_column(String(500), default="")
    verified_by: Mapped[str] = mapped_column(String(150), default="")
    verified_at: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    reject_reason: Mapped[str] = mapped_column(Text, default="")


class Announcement(Base):
    __tablename__ = "announcements"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(250))
    content: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(20), default="Umum")
    audience: Mapped[str] = mapped_column(String(10), default="semua")
    unit_id: Mapped[int | None] = mapped_column(FK("units.id"), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    author: Mapped[str] = mapped_column(String(150), default="")
    published_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.now)


class Event(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(250))
    date: Mapped[dt.date] = mapped_column(Date)
    end_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    location: Mapped[str] = mapped_column(String(200), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    unit_id: Mapped[int | None] = mapped_column(FK("units.id"), nullable=True)


class StudentRecord(Base):
    __tablename__ = "student_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(15))  # pelanggaran | prestasi | konseling
    category: Mapped[str] = mapped_column(String(40), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    points: Mapped[int] = mapped_column(Integer, default=0)
    date: Mapped[dt.date] = mapped_column(Date)
    recorded_by: Mapped[str] = mapped_column(String(150), default="")
    follow_up: Mapped[str] = mapped_column(String(250), default="")


class Promotion(Base):
    __tablename__ = "promotions"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))
    academic_year_id: Mapped[int] = mapped_column(ForeignKey("academic_years.id"))
    from_class_id: Mapped[int | None] = mapped_column(FK("classes.id"), nullable=True)
    to_class_id: Mapped[int | None] = mapped_column(FK("classes.id"), nullable=True)
    result: Mapped[str] = mapped_column(String(10))  # naik | tinggal | lulus
    note: Mapped[str] = mapped_column(Text, default="")
    processed_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.now)


class Extracurricular(Base):
    __tablename__ = "extracurriculars"
    id: Mapped[int] = mapped_column(primary_key=True)
    unit_id: Mapped[int | None] = mapped_column(FK("units.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(120))
    coach_id: Mapped[int | None] = mapped_column(FK("employees.id"), nullable=True)
    schedule: Mapped[str] = mapped_column(String(120), default="")
    member_ids: Mapped[list] = mapped_column(JSON, default=list)


class Lesson(Base):
    """Pelajaran e-learning dalam kursus (kelas + mapel), dikelompokkan per modul."""
    __tablename__ = "lessons"
    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    module: Mapped[str] = mapped_column(String(150))
    order: Mapped[int] = mapped_column(Integer, default=1)
    title: Mapped[str] = mapped_column(String(200))
    type: Mapped[str] = mapped_column(String(10))  # teks | video | dokumen | kuis
    content: Mapped[str] = mapped_column(Text, default="")
    video_url: Mapped[str] = mapped_column(String(500), default="")
    file_url: Mapped[str] = mapped_column(String(500), default="")
    duration: Mapped[int] = mapped_column(Integer, default=10)
    quiz: Mapped[list] = mapped_column(JSON, default=list)  # [{q, options[], answer}]
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.now)


class LessonProgress(Base):
    __tablename__ = "lesson_progress"
    __table_args__ = (UniqueConstraint("lesson_id", "student_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    completed_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.now)
    quiz_score: Mapped[float | None] = mapped_column(Float, nullable=True)


class VirtualClass(Base):
    __tablename__ = "virtual_classes"
    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    title: Mapped[str] = mapped_column(String(200))
    date: Mapped[dt.date] = mapped_column(Date, index=True)
    start_time: Mapped[str] = mapped_column(String(5))
    end_time: Mapped[str] = mapped_column(String(5))
    platform: Mapped[str] = mapped_column(String(30), default="Jitsi")
    link: Mapped[str] = mapped_column(String(500), default="")
    recording_url: Mapped[str] = mapped_column(String(500), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    attendee_ids: Mapped[list] = mapped_column(JSON, default=list)


class Discussion(Base):
    __tablename__ = "discussions"
    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("discussions.id", ondelete="CASCADE"), nullable=True)
    user_id: Mapped[int] = mapped_column(Integer, default=0)
    author: Mapped[str] = mapped_column(String(150))
    author_role: Mapped[str] = mapped_column(String(15))
    title: Mapped[str] = mapped_column(String(250), default="")
    body: Mapped[str] = mapped_column(Text)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.now)


class Enrollment(Base):
    """Arsip keanggotaan kelas per semester: dasar riwayat akademik & rapor semester lampau."""
    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("student_id", "academic_year_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    academic_year_id: Mapped[int] = mapped_column(ForeignKey("academic_years.id"))
    unit_id: Mapped[int] = mapped_column(ForeignKey("units.id"))
    class_id: Mapped[int | None] = mapped_column(FK("classes.id"), nullable=True)
    # Snapshot: nama kelas & wali kelas saat itu (kelas/wali kelas dapat berubah di tahun berikutnya)
    class_name: Mapped[str] = mapped_column(String(40))
    grade: Mapped[int] = mapped_column(Integer)
    homeroom_name: Mapped[str] = mapped_column(String(150), default="")
    sick: Mapped[int] = mapped_column(Integer, default=0)
    permit: Mapped[int] = mapped_column(Integer, default=0)
    absent: Mapped[int] = mapped_column(Integer, default=0)
    homeroom_note: Mapped[str] = mapped_column(Text, default="")
    result: Mapped[str | None] = mapped_column(String(10), nullable=True)  # naik | tinggal | lulus
    next_class_name: Mapped[str] = mapped_column(String(40), default="")


class Expense(Base):
    __tablename__ = "expenses"
    id: Mapped[int] = mapped_column(primary_key=True)
    unit_id: Mapped[int | None] = mapped_column(FK("units.id"), nullable=True)
    date: Mapped[dt.date] = mapped_column(Date, index=True)
    category: Mapped[str] = mapped_column(String(40))
    description: Mapped[str] = mapped_column(String(250))
    amount: Mapped[int] = mapped_column(Integer)
    method: Mapped[str] = mapped_column(String(20), default="Transfer Bank")
    receipt_url: Mapped[str] = mapped_column(String(500), default="")
    recorded_by: Mapped[str] = mapped_column(String(150), default="")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.now)


class LeaveRequest(Base):
    """Pengajuan izin/sakit online oleh orang tua/siswa, disetujui wali kelas."""
    __tablename__ = "leave_requests"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(Integer, default=0)
    submitted_by: Mapped[str] = mapped_column(String(150), default="")
    type: Mapped[str] = mapped_column(String(1))  # S | I
    start_date: Mapped[dt.date] = mapped_column(Date)
    end_date: Mapped[dt.date] = mapped_column(Date)
    reason: Mapped[str] = mapped_column(Text)
    attachment_url: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(10), default="menunggu")  # menunggu | disetujui | ditolak
    reviewed_by: Mapped[str] = mapped_column(String(150), default="")
    review_note: Mapped[str] = mapped_column(Text, default="")
    reviewed_at: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.now)


class TeachingJournal(Base):
    __tablename__ = "teaching_journals"
    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"), index=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"))
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"))
    date: Mapped[dt.date] = mapped_column(Date, index=True)
    start_time: Mapped[str] = mapped_column(String(5), default="")
    topic: Mapped[str] = mapped_column(String(250))
    activities: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    present: Mapped[int] = mapped_column(Integer, default=0)
    absent: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.now)


class Book(Base):
    __tablename__ = "books"
    id: Mapped[int] = mapped_column(primary_key=True)
    unit_id: Mapped[int | None] = mapped_column(FK("units.id"), nullable=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    isbn: Mapped[str] = mapped_column(String(20), default="")
    title: Mapped[str] = mapped_column(String(250), index=True)
    author: Mapped[str] = mapped_column(String(200), default="")
    publisher: Mapped[str] = mapped_column(String(150), default="")
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    category: Mapped[str] = mapped_column(String(30))
    location: Mapped[str] = mapped_column(String(50), default="")
    copies: Mapped[int] = mapped_column(Integer, default=1)
    cover_url: Mapped[str] = mapped_column(String(500), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.now)


class BookLoan(Base):
    __tablename__ = "book_loans"
    id: Mapped[int] = mapped_column(primary_key=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id"), index=True)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=True, index=True)
    employee_id: Mapped[int | None] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"), nullable=True, index=True)
    borrowed_at: Mapped[dt.date] = mapped_column(Date)
    due_date: Mapped[dt.date] = mapped_column(Date)
    returned_at: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    extended: Mapped[bool] = mapped_column(Boolean, default=False)
    fine: Mapped[int] = mapped_column(Integer, default=0)
    fine_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    bill_id: Mapped[int | None] = mapped_column(FK("bills.id"), nullable=True)  # tagihan denda di keuangan
    processed_by: Mapped[str] = mapped_column(String(150), default="")
    notes: Mapped[str] = mapped_column(Text, default="")


class BookReservation(Base):
    __tablename__ = "book_reservations"
    id: Mapped[int] = mapped_column(primary_key=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=True)
    employee_id: Mapped[int | None] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"), nullable=True)
    user_id: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(10), default="menunggu")  # menunggu | dipinjam | batal
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.now)


class ExamPeriod(Base):
    """Periode ujian (PTS/PAS/...) beserta syarat penerbitan kartu ujian."""
    __tablename__ = "exam_periods"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    type: Mapped[str] = mapped_column(String(5))
    academic_year_id: Mapped[int | None] = mapped_column(FK("academic_years.id"), nullable=True)
    unit_id: Mapped[int | None] = mapped_column(FK("units.id"), nullable=True)
    start_date: Mapped[dt.date] = mapped_column(Date)
    end_date: Mapped[dt.date] = mapped_column(Date)
    spp_until: Mapped[str] = mapped_column(String(7), default="")  # YYYY-MM
    required_fee_type_ids: Mapped[list] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str] = mapped_column(Text, default="")


class ExamDispensation(Base):
    __tablename__ = "exam_dispensations"
    __table_args__ = (UniqueConstraint("period_id", "student_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    period_id: Mapped[int] = mapped_column(ForeignKey("exam_periods.id", ondelete="CASCADE"))
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    reason: Mapped[str] = mapped_column(Text)
    granted_by: Mapped[str] = mapped_column(String(150), default="")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.now)


class ExamCheckin(Base):
    """Log verifikasi kartu ujian oleh pengawas."""
    __tablename__ = "exam_checkins"
    id: Mapped[int] = mapped_column(primary_key=True)
    period_id: Mapped[int] = mapped_column(ForeignKey("exam_periods.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    class_id: Mapped[int | None] = mapped_column(FK("classes.id"), nullable=True)
    exam_id: Mapped[int | None] = mapped_column(FK("exams.id"), nullable=True)
    valid: Mapped[bool] = mapped_column(Boolean, default=False)
    note: Mapped[str] = mapped_column(String(250), default="")
    checked_by: Mapped[str] = mapped_column(String(150), default="")
    checked_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.now)


class ExamWindow(Base):
    """Jadwal tambahan ujian susulan / remedial untuk siswa tertentu."""
    __tablename__ = "exam_windows"
    id: Mapped[int] = mapped_column(primary_key=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(10))  # susulan | remedial
    date: Mapped[dt.date] = mapped_column(Date)
    start_time: Mapped[str] = mapped_column(String(5))
    end_time: Mapped[str] = mapped_column(String(5))
    student_ids: Mapped[list] = mapped_column(JSON, default=list)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[str] = mapped_column(String(150), default="")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.now)


class ExamAttempt(Base):
    """Sesi pengerjaan CBT: waktu mulai & batas selesai tersimpan sehingga sisa waktu tetap berjalan."""
    __tablename__ = "exam_attempts"
    __table_args__ = (UniqueConstraint("exam_id", "student_id", "kind"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(10), default="utama")
    window_id: Mapped[int | None] = mapped_column(FK("exam_windows.id"), nullable=True)
    started_at: Mapped[dt.datetime] = mapped_column(DateTime)
    deadline: Mapped[dt.datetime] = mapped_column(DateTime)
    answers: Mapped[list] = mapped_column(JSON, default=list)
    submitted_at: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)


# Resource REST -> model (urutan = urutan aman untuk seeding karena foreign key)
RESOURCES: dict[str, type[Base]] = {
    "settings": Setting,
    "units": Unit,
    "academic_years": AcademicYear,
    "employees": Employee,
    "guardians": Guardian,
    "majors": Major,
    "subjects": Subject,
    "classes": SchoolClass,
    "students": Student,
    "users": User,
    "schedules": Schedule,
    "student_attendance": StudentAttendance,
    "employee_attendance": EmployeeAttendance,
    "materials": Material,
    "assignments": Assignment,
    "submissions": Submission,
    "exams": Exam,
    "exam_results": ExamResult,
    "grades": Grade,
    "fee_types": FeeType,
    "applicants": Applicant,
    "bills": Bill,
    "payments": Payment,
    "announcements": Announcement,
    "events": Event,
    "student_records": StudentRecord,
    "promotions": Promotion,
    "extracurriculars": Extracurricular,
    "lessons": Lesson,
    "lesson_progress": LessonProgress,
    "virtual_classes": VirtualClass,
    "discussions": Discussion,
    "enrollments": Enrollment,
    "expenses": Expense,
    "leave_requests": LeaveRequest,
    "teaching_journals": TeachingJournal,
    "books": Book,
    "book_loans": BookLoan,
    "book_reservations": BookReservation,
    "exam_periods": ExamPeriod,
    "exam_dispensations": ExamDispensation,
    "exam_checkins": ExamCheckin,
    "exam_windows": ExamWindow,
    "exam_attempts": ExamAttempt,
}
