import datetime as dt


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_login_wrong_password(client):
    r = client.post("/api/auth/login", json={"username": "admin", "password": "salah"})
    assert r.status_code == 401


def test_login_returns_user_without_password(client):
    r = client.post("/api/auth/login", json={"username": "admin", "password": "demo123"})
    body = r.json()
    assert body["user"]["role"] == "admin"
    assert "password_hash" not in body["user"]


def test_requires_auth(client):
    assert client.get("/api/students").status_code == 401


def test_admin_lists_all_students(client, auth):
    r = client.get("/api/students", headers=auth("admin"))
    assert r.status_code == 200
    assert len(r.json()) == 198


def test_filter_by_query_param(client, auth):
    rows = client.get("/api/students?status=lulus", headers=auth("admin")).json()
    assert rows and all(s["status"] == "lulus" for s in rows)


def test_siswa_only_sees_own_data(client, auth):
    h = auth("siswa")
    students = client.get("/api/students", headers=h).json()
    assert len(students) == 1
    sid = students[0]["id"]
    bills = client.get("/api/bills", headers=h).json()
    assert bills and all(b["student_id"] == sid for b in bills)
    assert client.get("/api/applicants", headers=h).json() == []
    users = client.get("/api/users", headers=h).json()
    assert len(users) == 1 and users[0]["username"] == "siswa"


def test_ortu_sees_two_children(client, auth):
    kids = client.get("/api/students", headers=auth("ortu")).json()
    assert len(kids) == 2


def test_exam_answer_key_hidden_for_student(client, auth):
    exams = client.get("/api/exams", headers=auth("siswa")).json()
    assert exams and all(q["answer"] == -1 for e in exams for q in e["questions"])
    staff = client.get("/api/exams", headers=auth("guru")).json()
    assert any(q["answer"] >= 0 for e in staff for q in e["questions"])


def test_write_permission_enforced(client, auth):
    r = client.post("/api/fee_types", headers=auth("guru"), json={"name": "X", "category": "lainnya", "amount": 1})
    assert r.status_code == 403


def test_crud_roundtrip(client, auth):
    h = auth("keuangan")
    r = client.post("/api/fee_types", headers=h, json={"name": "Study Tour", "category": "kegiatan", "amount": 750000, "unit_id": 3})
    assert r.status_code == 201, r.text
    fid = r.json()["id"]
    r = client.patch(f"/api/fee_types/{fid}", headers=h, json={"amount": 800000})
    assert r.json()["amount"] == 800000
    assert client.delete(f"/api/fee_types/{fid}", headers=h).status_code == 204


def test_public_portal_and_ppdb_flow(client, auth):
    portal = client.post("/api/actions/public.portal").json()
    assert portal["settings"]["name"] and len(portal["units"]) == 4
    reg = client.post("/api/actions/ppdb.register", json={
        "type": "pindahan", "unit_id": 3, "grade_target": 11, "major_id": 1, "name": "Uji Pindahan", "gender": "L",
        "birth_place": "Bandung", "birth_date": "2010-05-05", "origin_school": "SMA N 1", "address": "Jl. Uji",
        "parent_name": "Pak Uji", "parent_phone": "081200001111",
    })
    assert reg.status_code == 200, reg.text
    app_ = reg.json()["applicant"]
    bill = reg.json()["bill"]
    st = client.post("/api/actions/ppdb.status", json={"reg_no": app_["reg_no"], "birth_date": "2010-05-05"}).json()
    assert st["applicant"]["status"] == "baru"
    assert client.post("/api/actions/ppdb.pay", json={"bill_id": bill["id"], "method": "QRIS"}).status_code == 200
    h = auth("kesiswaan")
    client.patch(f"/api/applicants/{app_['id']}", headers=h, json={"status": "diterima", "test_score": 88})
    classes = client.get("/api/classes?unit_id=3&grade=11", headers=h).json()
    enr = client.post("/api/actions/ppdb.enroll", headers=h, json={"applicant_id": app_["id"], "class_id": classes[0]["id"]})
    assert enr.status_code == 200, enr.text
    # akun siswa baru dapat login
    login = client.post("/api/auth/login", json={"username": enr.json()["username"], "password": "demo123"})
    assert login.status_code == 200


def test_family_payment_and_ownership(client, auth):
    h = auth("ortu")
    bills = [b for b in client.get("/api/bills", headers=h).json() if b["status"] != "lunas"]
    assert bills
    b = bills[0]
    remaining = b["amount"] - b["discount"] - b["paid_amount"]
    r = client.post("/api/actions/payments.pay", headers=h, json={"bill_id": b["id"], "amount": remaining, "method": "Virtual Account"})
    assert r.status_code == 200, r.text
    # tidak boleh membayar tagihan siswa lain
    other = client.get("/api/bills?status=belum", headers=auth("admin")).json()
    own_ids = {k["id"] for k in client.get("/api/students", headers=h).json()}
    foreign = next(x for x in other if x["student_id"] and x["student_id"] not in own_ids)
    r = client.post("/api/actions/payments.pay", headers=h, json={"bill_id": foreign["id"], "amount": 1, "method": "QRIS"})
    assert r.status_code == 403


def test_overpayment_rejected(client, auth):
    h = auth("keuangan")
    b = client.get("/api/bills?status=belum", headers=h).json()[0]
    r = client.post("/api/actions/payments.pay", headers=h, json={"bill_id": b["id"], "amount": b["amount"] * 2, "method": "Tunai"})
    assert r.status_code == 400


def test_cbt_submit_scores_on_server(client, auth):
    h = auth("siswa")
    me = client.get("/api/students", headers=h).json()[0]
    taken = {r["exam_id"] for r in client.get("/api/exam_results", headers=h).json()}
    exam = next(e for e in client.get(f"/api/exams?class_id={me['class_id']}", headers=h).json() if e["id"] not in taken)
    r = client.post("/api/actions/exams.submit", headers=h, json={"exam_id": exam["id"], "student_id": me["id"], "answers": [0] * len(exam["questions"])})
    assert r.status_code == 200, r.text
    assert 0 <= r.json()["score"] <= 100 and r.json()["total"] == len(exam["questions"])
    again = client.post("/api/actions/exams.submit", headers=h, json={"exam_id": exam["id"], "student_id": me["id"], "answers": []})
    assert again.status_code == 400


def test_teacher_attendance_and_grades(client, auth):
    h = auth("guru")
    me = client.get("/api/auth/me", headers=h).json()
    r = client.post("/api/actions/attendance.checkin", headers=h, json={"employee_id": me["employee_id"]})
    assert r.status_code == 200
    assert client.post("/api/actions/attendance.checkin", headers=h, json={"employee_id": me["employee_id"]}).status_code == 400
    # guru tidak boleh presensi atas nama orang lain
    assert client.post("/api/actions/attendance.checkin", headers=h, json={"employee_id": 1}).status_code == 403
    sched = client.get(f"/api/schedules?teacher_id={me['employee_id']}", headers=h).json()[0]
    students = client.get(f"/api/students?class_id={sched['class_id']}", headers=h).json()
    day = dt.date.today() - dt.timedelta(days=1)
    r = client.post("/api/actions/attendance.saveClass", headers=h, json={"class_id": sched["class_id"], "date": day.isoformat(), "entries": [{"student_id": s["id"], "status": "H", "note": ""} for s in students]})
    assert r.json()["saved"] == len(students)
    ay = next(y for y in client.get("/api/academic_years", headers=h).json() if y["is_active"])
    r = client.post("/api/actions/grades.save", headers=h, json={"rows": [{"student_id": students[0]["id"], "subject_id": sched["subject_id"], "academic_year_id": ay["id"], "assignment": 90, "daily": 80, "midterm": 70, "final_exam": 100}]})
    assert r.status_code == 200
    g = client.get(f"/api/grades?student_id={students[0]['id']}&subject_id={sched['subject_id']}", headers=h).json()[0]
    assert g["final"] == 87.0  # 27 + 16 + 14 + 30


def test_generate_bills_is_idempotent(client, auth):
    h = auth("keuangan")
    fee = next(f for f in client.get("/api/fee_types", headers=h).json() if f["name"] == "SPP SMK")
    first = client.post("/api/actions/bills.generate", headers=h, json={"fee_type_id": fee["id"], "period": "2026-12", "due_date": "2026-12-10"}).json()
    second = client.post("/api/actions/bills.generate", headers=h, json={"fee_type_id": fee["id"], "period": "2026-12", "due_date": "2026-12-10"}).json()
    assert first["created"] > 0 and second["created"] == 0 and second["skipped"] == first["created"]


def test_promotion_graduates_students(client, auth):
    h = auth("admin")
    cls = next(c for c in client.get("/api/classes?unit_id=4&grade=12", headers=h).json())
    studs = client.get(f"/api/students?class_id={cls['id']}", headers=h).json()
    ay = next(y for y in client.get("/api/academic_years", headers=h).json() if y["is_active"])
    r = client.post("/api/actions/promotions.process", headers=h, json={"academic_year_id": ay["id"], "decisions": [{"student_id": s["id"], "result": "lulus", "to_class_id": None} for s in studs]})
    assert r.json()["processed"] == len(studs)
    after = client.get(f"/api/students/{studs[0]['id']}", headers=h).json()
    assert after["status"] == "lulus" and after["class_id"] is None


# ------------------------------------------------------------------ e-learning
def _my_lessons(client, h):
    me = client.get("/api/students", headers=h).json()[0]
    return me, client.get(f"/api/lessons?class_id={me['class_id']}", headers=h).json()


def test_lessons_hide_quiz_key_and_drafts_for_student(client, auth):
    me, lessons = _my_lessons(client, auth("siswa"))
    assert lessons and all(l["is_published"] for l in lessons)
    assert all(q["answer"] == -1 for l in lessons for q in l["quiz"])
    staff = client.get(f"/api/lessons?class_id={me['class_id']}", headers=auth("guru")).json()
    assert any(not l["is_published"] for l in staff)  # guru melihat draf
    assert any(q["answer"] >= 0 for l in staff for q in l["quiz"])


def test_complete_lesson_and_quiz_scored_on_server(client, auth):
    h = auth("siswa")
    me, lessons = _my_lessons(client, h)
    text = next(l for l in lessons if l["type"] == "teks")
    r = client.post("/api/actions/elearning.complete", headers=h, json={"lesson_id": text["id"], "student_id": me["id"]})
    assert r.status_code == 200 and r.json()["score"] is None
    quiz = next(l for l in lessons if l["type"] == "kuis")
    # jawaban tidak lengkap ditolak
    assert client.post("/api/actions/elearning.complete", headers=h, json={"lesson_id": quiz["id"], "student_id": me["id"], "answers": []}).status_code == 400
    r = client.post("/api/actions/elearning.complete", headers=h, json={"lesson_id": quiz["id"], "student_id": me["id"], "answers": [0] * len(quiz["quiz"])})
    body = r.json()
    assert r.status_code == 200 and body["total"] == len(quiz["quiz"]) and 0 <= body["score"] <= 100
    prog = client.get(f"/api/lesson_progress?lesson_id={quiz['id']}", headers=h).json()
    assert len(prog) == 1 and prog[0]["student_id"] == me["id"]
    # guru tidak dapat menyelesaikan pelajaran atas nama siswa
    assert client.post("/api/actions/elearning.complete", headers=auth("guru"), json={"lesson_id": text["id"], "student_id": me["id"]}).status_code == 403


def test_virtual_class_join_records_attendance(client, auth):
    h = auth("siswa")
    me = client.get("/api/students", headers=h).json()[0]
    import datetime as dt
    vcs = client.get(f"/api/virtual_classes?class_id={me['class_id']}", headers=h).json()
    todays = [v for v in vcs if v["date"] == dt.date.today().isoformat()]
    assert todays
    r = client.post("/api/actions/elearning.join", headers=h, json={"virtual_class_id": todays[0]["id"], "student_id": me["id"]})
    assert r.status_code == 200 and r.json()["link"].startswith("https://")
    after = client.get(f"/api/virtual_classes/{todays[0]['id']}", headers=h).json()
    assert me["id"] in after["attendee_ids"]
    future = next(v for v in vcs if v["date"] > dt.date.today().isoformat())
    assert client.post("/api/actions/elearning.join", headers=h, json={"virtual_class_id": future["id"], "student_id": me["id"]}).status_code == 400


def test_discussion_permissions(client, auth):
    h = auth("siswa")
    me = client.get("/api/students", headers=h).json()[0]
    lesson = client.get(f"/api/lessons?class_id={me['class_id']}", headers=h).json()[0]
    course = {"class_id": me["class_id"], "subject_id": lesson["subject_id"]}
    t = client.post("/api/actions/discussions.post", headers=h, json={**course, "title": "Tanya", "body": "Bagaimana caranya?"})
    assert t.status_code == 200, t.text
    reply = client.post("/api/actions/discussions.post", headers=auth("guru"), json={**course, "parent_id": t.json()["id"], "body": "Begini caranya."})
    assert reply.status_code == 200
    # ortu hanya membaca; siswa tidak boleh menyematkan atau menghapus milik orang lain
    assert client.post("/api/actions/discussions.post", headers=auth("ortu"), json={**course, "title": "x", "body": "y"}).status_code == 403
    assert client.post("/api/actions/discussions.pin", headers=h, json={"id": t.json()["id"]}).status_code == 403
    assert client.post("/api/actions/discussions.delete", headers=h, json={"id": reply.json()["id"]}).status_code == 403
    # siswa tidak boleh menulis langsung lewat CRUD
    assert client.post("/api/discussions", headers=h, json={**course, "author": "x", "author_role": "guru", "body": "palsu"}).status_code == 403
    assert client.post("/api/actions/discussions.delete", headers=h, json={"id": t.json()["id"]}).status_code == 200
    ids = {d["id"] for d in client.get(f"/api/discussions?class_id={me['class_id']}", headers=h).json()}
    assert t.json()["id"] not in ids and reply.json()["id"] not in ids


# ------------------------------------------------------------------ riwayat akademik
def test_student_sees_own_history_and_past_grades(client, auth):
    h = auth("siswa")
    me = client.get("/api/students", headers=h).json()[0]
    enr = client.get("/api/enrollments", headers=h).json()
    assert enr and all(e["student_id"] == me["id"] for e in enr)
    years = {y["id"]: y for y in client.get("/api/academic_years", headers=h).json()}
    past = [e for e in enr if not years[e["academic_year_id"]]["is_active"]]
    assert past and past[-1]["result"] == "naik" and past[-1]["class_name"].startswith("X")
    grades = client.get(f"/api/grades?academic_year_id={past[0]['academic_year_id']}", headers=h).json()
    assert grades and all(g["student_id"] == me["id"] for g in grades)


def test_sd_student_has_history_since_grade_one(client, auth):
    h = auth("admin")
    cls = client.get("/api/classes?name=3A", headers=h).json()[0]
    st = client.get(f"/api/students?class_id={cls['id']}", headers=h).json()
    baru = next(s for s in st if s["entry_type"] == "baru")
    names = [e["class_name"] for e in client.get(f"/api/enrollments?student_id={baru['id']}", headers=h).json()]
    assert names == ["1A", "1A", "2A", "2A"]


def test_archive_semester_is_idempotent_and_admin_only(client, auth):
    h = auth("admin")
    ay = next(y for y in client.get("/api/academic_years", headers=h).json() if y["is_active"])
    assert client.post("/api/actions/academic_years.archive", headers=auth("guru"), json={"id": ay["id"]}).status_code == 403
    first = client.post("/api/actions/academic_years.archive", headers=h, json={"id": ay["id"]}).json()
    second = client.post("/api/actions/academic_years.archive", headers=h, json={"id": ay["id"]}).json()
    assert first["archived"] == second["archived"] > 0
    rows = client.get(f"/api/enrollments?academic_year_id={ay['id']}", headers=h).json()
    ids = [r["student_id"] for r in rows]
    assert len(ids) == len(set(ids)) >= first["archived"]  # satu arsip per siswa, tanpa duplikat
    assert all(r["class_name"] and r["homeroom_name"] for r in rows)


# ------------------------------------------------------------------ impor data
def test_import_dry_run_then_commit(client, auth):
    h = auth("admin")
    rows = [
        {"nis": "9990001", "nama": "Impor Satu", "jk": "L", "unit": "SD", "kelas": "3A", "tanggal_lahir": "17/05/2017", "nama_ortu": "Ortu Impor", "hp_ortu": "089900000001"},
        {"nis": "9990002", "nama": "Impor Dua", "jk": "X", "unit": "SD", "kelas": "9Z"},  # error
        {"nis": "9990001", "nama": "Duplikat", "jk": "P", "unit": "SD", "kelas": "3A"},  # duplikat
    ]
    dry = client.post("/api/actions/import.run", headers=h, json={"kind": "siswa", "rows": rows, "dry_run": True}).json()
    assert dry["created"] == 1 and dry["failed"] == 2 and dry["dry_run"]
    assert not client.get("/api/students?nis=9990001", headers=h).json()  # belum tersimpan
    done = client.post("/api/actions/import.run", headers=h, json={"kind": "siswa", "rows": rows, "dry_run": False}).json()
    assert done["created"] == 1 and done["accounts"] == 2
    st = client.get("/api/students?nis=9990001", headers=h).json()[0]
    assert st["birth_date"] == "2017-05-17"
    assert client.post("/api/auth/login", json={"username": "9990001", "password": "demo123"}).status_code == 200
    # impor ulang = perbarui, bukan duplikat
    again = client.post("/api/actions/import.run", headers=h, json={"kind": "siswa", "rows": rows[:1], "dry_run": False}).json()
    assert again["updated"] == 1 and again["created"] == 0


def test_import_history_and_grades_create_academic_year(client, auth):
    h = auth("admin")
    hist = client.post("/api/actions/import.run", headers=h, json={"kind": "riwayat_kelas", "dry_run": False, "rows": [
        {"nis": "9990001", "tahun_ajaran": "2019/2020", "semester": "Genap", "kelas": "1A", "tingkat": 1, "sakit": 2, "keputusan": "naik", "naik_ke": "2A"},
        {"nis": "0000000", "tahun_ajaran": "2019/2020", "semester": "Genap", "kelas": "1A", "tingkat": 1},
    ]}).json()
    assert hist["created"] == 1 and hist["failed"] == 1
    grades = client.post("/api/actions/import.run", headers=h, json={"kind": "nilai", "dry_run": False, "rows": [
        {"nis": "9990001", "tahun_ajaran": "2019/2020", "semester": "Genap", "mapel": "MTK", "nilai_tugas": 90, "nilai_harian": 80, "nilai_pts": 70, "nilai_pas": 100},
        {"nis": "9990001", "tahun_ajaran": "2019/2020", "semester": "Genap", "mapel": "Bahasa Indonesia", "nilai_akhir": "88,5"},
        {"nis": "9990001", "tahun_ajaran": "2019/2020", "semester": "Genap", "mapel": "KIMIA", "nilai_akhir": 80},
        {"nis": "9990001", "tahun_ajaran": "2019/2020", "semester": "Genap", "mapel": "PJOK", "nilai_akhir": 120},
    ]}).json()
    assert grades["created"] == 2 and grades["failed"] == 2
    years = client.get("/api/academic_years", headers=h).json()
    ay = next(y for y in years if y["name"] == "2019/2020" and y["semester"] == "Genap")
    assert not ay["is_active"]
    st = client.get("/api/students?nis=9990001", headers=h).json()[0]
    g = {x["final"] for x in client.get(f"/api/grades?student_id={st['id']}&academic_year_id={ay['id']}", headers=h).json()}
    assert g == {87.0, 88.5}


def test_import_permissions(client, auth):
    rows = [{"nip": "123", "nama": "X", "jenis": "guru", "jabatan": "Guru"}]
    assert client.post("/api/actions/import.run", headers=auth("kesiswaan"), json={"kind": "pegawai", "rows": rows}).status_code == 403
    assert client.post("/api/actions/import.run", headers=auth("guru"), json={"kind": "nilai", "rows": rows}).status_code == 403


# ------------------------------------------------------------------ akun, izin, jurnal, pengeluaran
def test_change_password(client, auth):
    h = auth("kesiswaan")
    assert client.post("/api/actions/auth.changePassword", headers=h, json={"old_password": "salah", "new_password": "baru123"}).status_code == 400
    assert client.post("/api/actions/auth.changePassword", headers=h, json={"old_password": "demo123", "new_password": "baru123"}).status_code == 200
    assert client.post("/api/auth/login", json={"username": "kesiswaan", "password": "baru123"}).status_code == 200
    client.post("/api/actions/auth.changePassword", headers=h, json={"old_password": "baru123", "new_password": "demo123"})


def test_leave_request_flow_updates_attendance(client, auth):
    import datetime as dt
    ho = auth("ortu")
    kids = client.get("/api/students", headers=ho).json()
    child = next(k for k in kids if k["name"] == "Rizky Aditya Pratama")
    day = dt.date.today() + dt.timedelta(days=1)
    while day.weekday() >= 5:
        day += dt.timedelta(days=1)
    r = client.post("/api/actions/leave.submit", headers=ho, json={"student_id": child["id"], "type": "S", "start_date": day.isoformat(), "end_date": day.isoformat(), "reason": "Demam"})
    assert r.status_code == 200, r.text
    # ortu tidak boleh mengajukan untuk anak orang lain
    other = client.get("/api/students?status=aktif", headers=auth("admin")).json()
    foreign = next(s for s in other if s["id"] not in {k["id"] for k in kids})
    assert client.post("/api/actions/leave.submit", headers=ho, json={"student_id": foreign["id"], "type": "I", "start_date": day.isoformat(), "end_date": day.isoformat(), "reason": "x"}).status_code == 403
    # wali kelas lain / keuangan tidak boleh menyetujui
    assert client.post("/api/actions/leave.review", headers=auth("keuangan"), json={"id": r.json()["id"], "status": "disetujui"}).status_code == 403
    ok = client.post("/api/actions/leave.review", headers=auth("guru"), json={"id": r.json()["id"], "status": "disetujui", "note": "Semoga cepat sembuh"})
    assert ok.status_code == 200 and ok.json()["days"] == 1
    att = client.get(f"/api/student_attendance?student_id={child['id']}&date={day.isoformat()}", headers=ho).json()
    assert att and att[0]["status"] == "S"


def test_teaching_journal_owner_enforced(client, auth):
    h = auth("guru")
    me = client.get("/api/auth/me", headers=h).json()
    sched = client.get(f"/api/schedules?teacher_id={me['employee_id']}", headers=h).json()[0]
    r = client.post("/api/teaching_journals", headers=h, json={"teacher_id": 1, "class_id": sched["class_id"], "subject_id": sched["subject_id"], "date": "2026-09-01", "start_time": "07:30", "topic": "Uji"})
    assert r.status_code == 201 and r.json()["teacher_id"] == me["employee_id"]  # teacher_id dipaksa milik sendiri
    other = next(j for j in client.get("/api/teaching_journals", headers=h).json() if j["teacher_id"] != me["employee_id"])
    assert client.patch(f"/api/teaching_journals/{other['id']}", headers=h, json={"topic": "ubah"}).status_code == 403
    assert client.get("/api/teaching_journals", headers=auth("siswa")).json() == []


def test_expenses_finance_only(client, auth):
    assert client.get("/api/expenses", headers=auth("keuangan")).json()
    assert client.get("/api/expenses", headers=auth("guru")).json() == []
    assert client.get("/api/expenses", headers=auth("ortu")).json() == []
    assert client.post("/api/expenses", headers=auth("kesiswaan"), json={"date": "2026-09-01", "category": "Lainnya", "description": "x", "amount": 1}).status_code == 403


# ------------------------------------------------------------------ perpustakaan
def _book(client, h, title):
    return next(b for b in client.get("/api/books", headers=h).json() if b["title"] == title)


def test_library_borrow_return_with_fine(client, auth):
    h = auth("pustakawan")
    book = _book(client, h, "Bumi Manusia")
    st = next(s for s in client.get("/api/students?status=aktif", headers=h).json() if s["unit_id"] == 2)
    loan = client.post("/api/actions/library.borrow", headers=h, json={"book_id": book["id"], "student_id": st["id"]})
    assert loan.status_code == 200, loan.text
    # tidak boleh meminjam buku yang sama dua kali
    assert client.post("/api/actions/library.borrow", headers=h, json={"book_id": book["id"], "student_id": st["id"]}).status_code == 400
    ret = client.post("/api/actions/library.return", headers=h, json={"loan_id": loan.json()["id"]}).json()
    assert ret["late_days"] == 0 and ret["fine"] == 0 and ret["fine_paid"]


def test_library_blocks_overdue_borrower_and_computes_fine(client, auth):
    h = auth("pustakawan")
    ho = auth("ortu")
    late = next(l for l in client.get("/api/book_loans", headers=ho).json() if l["returned_at"] is None and l["due_date"] < __import__("datetime").date.today().isoformat())
    other_book = _book(client, h, "Hujan")
    r = client.post("/api/actions/library.borrow", headers=h, json={"book_id": other_book["id"], "student_id": late["student_id"]})
    assert r.status_code == 400 and "terlambat" in r.json()["detail"]
    ret = client.post("/api/actions/library.return", headers=h, json={"loan_id": late["id"], "pay_fine": False}).json()
    assert ret["late_days"] > 0 and ret["fine"] == ret["late_days"] * 500 and not ret["fine_paid"]
    # denda belum dibayar tetap memblokir
    assert "denda" in client.post("/api/actions/library.borrow", headers=h, json={"book_id": other_book["id"], "student_id": late["student_id"]}).json()["detail"]
    assert client.post("/api/actions/library.payFine", headers=h, json={"loan_id": late["id"]}).status_code == 200
    assert client.post("/api/actions/library.borrow", headers=h, json={"book_id": other_book["id"], "student_id": late["student_id"]}).status_code == 200


def test_library_permissions_and_scoping(client, auth):
    hs = auth("siswa")
    me = client.get("/api/students", headers=hs).json()[0]
    assert all(l["student_id"] == me["id"] for l in client.get("/api/book_loans", headers=hs).json())
    hg = auth("guru")
    gme = client.get("/api/auth/me", headers=hg).json()
    assert all(l["employee_id"] == gme["employee_id"] for l in client.get("/api/book_loans", headers=hg).json())
    book = _book(client, hs, "Atlas Indonesia dan Dunia")
    # siswa tidak boleh mencatat peminjaman / mengubah katalog
    assert client.post("/api/actions/library.borrow", headers=hs, json={"book_id": book["id"], "student_id": me["id"]}).status_code == 403
    assert client.patch(f"/api/books/{book['id']}", headers=hs, json={"copies": 99}).status_code == 403


def test_library_reserve_extend_and_settings(client, auth):
    hs = auth("siswa")
    book = _book(client, hs, "Atlas Indonesia dan Dunia")
    r = client.post("/api/actions/library.reserve", headers=hs, json={"book_id": book["id"]})
    assert r.status_code == 200
    assert client.post("/api/actions/library.reserve", headers=hs, json={"book_id": book["id"]}).status_code == 400  # duplikat
    assert client.post("/api/actions/library.cancelReservation", headers=hs, json={"id": r.json()["id"]}).json()["status"] == "batal"
    active = next(l for l in client.get("/api/book_loans", headers=hs).json() if l["returned_at"] is None)
    ext = client.post("/api/actions/library.extend", headers=hs, json={"loan_id": active["id"]})
    assert ext.status_code == 200 and ext.json()["extended"]
    assert client.post("/api/actions/library.extend", headers=hs, json={"loan_id": active["id"]}).status_code == 400  # hanya sekali
    hp = auth("pustakawan")
    cfg = client.post("/api/actions/library.settings", headers=hp, json={"library_loan_days": 14, "library_max_loans": 2, "library_fine_per_day": 1000}).json()
    assert cfg["library_loan_days"] == 14
    assert client.post("/api/actions/library.settings", headers=auth("guru"), json={"library_loan_days": 1, "library_max_loans": 1, "library_fine_per_day": 0}).status_code == 403
    client.post("/api/actions/library.settings", headers=hp, json={"library_loan_days": 7, "library_max_loans": 3, "library_fine_per_day": 500})


def test_import_books(client, auth):
    h = auth("pustakawan")
    res = client.post("/api/actions/import.run", headers=h, json={"kind": "buku", "dry_run": False, "rows": [
        {"kode": "UJI-001", "judul": "Buku Uji Impor", "kategori": "fiksi", "jumlah_eksemplar": 2, "tahun": 2020},
        {"kode": "UJI-002", "judul": "Kategori Salah", "kategori": "Komik", "jumlah_eksemplar": 1},
        {"kode": "FIK-001", "judul": "Laskar Pelangi", "kategori": "Fiksi", "jumlah_eksemplar": 6},
    ]}).json()
    assert res["created"] == 1 and res["updated"] == 1 and res["failed"] == 1
    assert _book(client, h, "Laskar Pelangi")["copies"] == 6
    assert client.post("/api/actions/import.run", headers=auth("kesiswaan"), json={"kind": "buku", "rows": [{"kode": "x"}]}).status_code == 403
