'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getSession, useData } from './api';
import type { Employee, Guardian, Role, Student, User } from './types';

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrator',
  kepsek: 'Kepala Sekolah',
  keuangan: 'Bagian Keuangan',
  kesiswaan: 'Bagian Kesiswaan',
  pustakawan: 'Pustakawan',
  guru: 'Guru',
  siswa: 'Siswa',
  ortu: 'Orang Tua / Wali',
};

export const STAFF_ROLES: Role[] = ['admin', 'kepsek', 'keuangan', 'kesiswaan', 'pustakawan'];

interface AuthCtx {
  user: User | null;
  ready: boolean;
  login: (u: string, p: string) => Promise<User>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({ user: null, ready: false, login: async () => { throw new Error('no provider'); }, logout: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setUser(getSession().user);
    setReady(true);
  }, []);
  const login = useCallback(async (u: string, p: string) => {
    const usr = await api.login(u, p);
    setUser(usr);
    return usr;
  }, []);
  const logout = useCallback(() => {
    api.logout();
    setUser(null);
  }, []);
  return <Ctx.Provider value={{ user, ready, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

/* ---------- Workspace context: unit aktif (staf) & anak aktif (ortu) ---------- */
interface WorkspaceCtx {
  unitId: number; // 0 = semua unit
  setUnitId: (id: number) => void;
  childId: number | null;
  setChildId: (id: number) => void;
}
const WCtx = createContext<WorkspaceCtx>({ unitId: 0, setUnitId: () => {}, childId: null, setChildId: () => {} });

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [unitId, setUnit] = useState(0);
  const [childId, setChild] = useState<number | null>(null);
  useEffect(() => {
    try {
      setUnit(Number(localStorage.getItem('ischool-unit') || 0));
      const c = localStorage.getItem('ischool-child');
      if (c) setChild(Number(c));
    } catch {
      /* ignore */
    }
  }, []);
  const setUnitId = (id: number) => {
    setUnit(id);
    try { localStorage.setItem('ischool-unit', String(id)); } catch { /* ignore */ }
  };
  const setChildId = (id: number) => {
    setChild(id);
    try { localStorage.setItem('ischool-child', String(id)); } catch { /* ignore */ }
  };
  return <WCtx.Provider value={{ unitId, setUnitId, childId, setChildId }}>{children}</WCtx.Provider>;
}

export const useWorkspace = () => useContext(WCtx);

/** Profil terkait user login: pegawai, siswa, atau anak-anak (untuk ortu). */
export function useProfile() {
  const { user } = useAuth();
  const { childId, unitId } = useWorkspace();
  const { data } = useData(['employees', 'students', 'guardians']);
  return useMemo(() => {
    const employee: Employee | undefined = user?.employee_id ? data?.employees.find((e) => e.id === user.employee_id) : undefined;
    const guardian: Guardian | undefined = user?.guardian_id ? data?.guardians.find((g) => g.id === user.guardian_id) : undefined;
    const children: Student[] = guardian ? (data?.students.filter((s) => s.guardian_id === guardian.id) ?? []) : [];
    let student: Student | undefined;
    if (user?.role === 'siswa') student = data?.students.find((s) => s.id === user.student_id);
    if (user?.role === 'ortu') student = children.find((c) => c.id === childId) || children[0];
    // Unit efektif untuk filter data
    let effectiveUnit = unitId;
    if (user?.role === 'guru' && employee?.unit_id) effectiveUnit = employee.unit_id;
    if (student) effectiveUnit = student.unit_id;
    return { loaded: !!data, employee, guardian, children, student, unitId: effectiveUnit };
  }, [user, data, childId, unitId]);
}
