"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const empty = { seats: [], occupied: [], held: [], expiresAt: null, error: "", loading: false, pending: false, offset: 0 };

async function seatRequest(showtimeId, token, options) {
    const response = await fetch(`/api/showtimes/${encodeURIComponent(showtimeId)}/seats${options ? "" : `?holdToken=${encodeURIComponent(token)}`}`, {
        cache: "no-store", ...(!options ? { signal: AbortSignal.timeout(10000) } : {}), ...options,
        headers: { "Content-Type": "application/json" },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Không thể cập nhật ghế. Vui lòng thử lại.");
    return body;
}

function release(context) {
    return fetch(`/api/showtimes/${encodeURIComponent(context.id)}/seats`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdToken: context.token }), keepalive: true,
    }).catch(() => {});
}

// Each show selection gets its own token, so a late release from an old screen
// cannot release seats selected after returning to that show.
export function useSeatHold(showtimeId, paused = false) {
    const contextRef = useRef(null);
    const pausedRef = useRef(paused);
    pausedRef.current = paused;
    const [state, setState] = useState(empty);
    const [clock, setClock] = useState(0);

    const apply = useCallback((context, snapshot, intentionalRelease = false) => {
        if (!context.active || contextRef.current !== context) return;
        const expiresAt = Number(snapshot.expiresAt) || null;
        const offset = Number(snapshot.serverNow) - Date.now();
        const expired = expiresAt && expiresAt <= Number(snapshot.serverNow);
        const seats = expired ? [] : snapshot.selected || [];
        const lost = !intentionalRelease && context.seats.length > 0 && !seats.length;
        context.seats = seats;
        context.expiresAt = seats.length ? expiresAt : null;
        context.offset = Number.isFinite(offset) ? offset : 0;
        setState(previous => ({ ...previous, seats, occupied: snapshot.occupied || [], held: snapshot.held || [],
            expiresAt: context.expiresAt, offset: context.offset, loading: false,
            error: lost ? "Thời gian giữ ghế đã hết hoặc ghế không còn được giữ. Vui lòng chọn lại ghế." : "" }));
        setClock(Date.now());
    }, []);

    const reload = useCallback(async () => {
        const context = contextRef.current;
        if (!context?.active || context.pending || context.reading || pausedRef.current) return;
        context.reading = true;
        const revision = context.revision;
        try {
            const snapshot = await seatRequest(context.id, context.token);
            if (revision === context.revision && !context.pending && !pausedRef.current) apply(context, snapshot);
        } catch (error) {
            if (context.active && contextRef.current === context && revision === context.revision)
                setState(previous => ({ ...previous, loading: false, error: error.message }));
        } finally { context.reading = false; }
    }, [apply]);

    useEffect(() => {
        setState({ ...empty, loading: Boolean(showtimeId) });
        if (!showtimeId) { contextRef.current = null; return; }
        const context = { id: showtimeId, token: crypto.randomUUID(), active: true, revision: 0, seats: [], expiresAt: null, offset: 0, pending: false, reading: false, mutation: null };
        contextRef.current = context;
        void reload();
        const poll = window.setInterval(() => void reload(), 1000);
        const tick = window.setInterval(() => {
            setClock(Date.now());
            if (context.expiresAt && Date.now() + context.offset >= context.expiresAt && !context.pending && !pausedRef.current) {
                context.revision++;
                context.seats = [];
                context.expiresAt = null;
                setState(previous => ({ ...previous, seats: [], expiresAt: null, error: "Thời gian giữ ghế đã hết. Vui lòng chọn lại ghế." }));
                void reload();
            }
        }, 250);
        const onPageHide = () => { void release(context); };
        window.addEventListener("pagehide", onPageHide);
        return () => {
            context.active = false;
            context.revision++;
            window.clearInterval(poll);
            window.clearInterval(tick);
            window.removeEventListener("pagehide", onPageHide);
            void release(context);
            // A mutation already accepted by the server may finish after DELETE.
            if (context.mutation) void context.mutation.finally(() => release(context));
        };
    }, [showtimeId, reload]);

    const toggleSeat = useCallback(async seat => {
        const context = contextRef.current;
        if (!context?.active || context.id !== showtimeId || context.pending || pausedRef.current) return;
        const selected = context.seats.includes(seat);
        if (!selected && context.seats.length >= 8) {
            setState(previous => ({ ...previous, error: "Mỗi đơn được chọn tối đa 8 ghế." }));
            return;
        }
        const seats = selected ? context.seats.filter(item => item !== seat) : [...context.seats, seat];
        context.pending = true;
        context.revision++;
        setState(previous => ({ ...previous, pending: true, error: "" }));
        const mutation = (async () => {
            try {
                const snapshot = await seatRequest(context.id, context.token, { method: "PUT", body: JSON.stringify({ holdToken: context.token, seats }) });
                apply(context, snapshot, seats.length === 0);
            } catch (error) {
                // Reconcile a conflict or an uncertain network response against
                // the server, without automatically trying to acquire seats again.
                try { apply(context, await seatRequest(context.id, context.token)); } catch { /* preserve original error */ }
                if (context.active && contextRef.current === context)
                    setState(previous => ({ ...previous, error: error.message }));
            } finally {
                context.pending = false;
                if (context.active && contextRef.current === context)
                    setState(previous => ({ ...previous, pending: false }));
            }
        })();
        context.mutation = mutation;
        await mutation;
        if (context.mutation === mutation) context.mutation = null;
    }, [showtimeId, apply]);

    const complete = useCallback(paidSeats => {
        const context = contextRef.current;
        if (!context) return;
        context.revision++;
        context.seats = [];
        context.expiresAt = null;
        setState(previous => ({ ...previous, seats: [], expiresAt: null, error: "", occupied: [...new Set([...previous.occupied, ...paidSeats])] }));
    }, []);

    const current = contextRef.current?.id === showtimeId;
    const visible = current ? state : { ...empty, loading: Boolean(showtimeId) };
    const remainingSeconds = visible.expiresAt ? Math.max(0, Math.ceil((visible.expiresAt - (clock + visible.offset)) / 1000)) : 0;
    const countdown = `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`;
    return { ...visible, holdToken: current ? contextRef.current?.token : "", toggleSeat, reload, complete, remainingSeconds, countdown,
        valid: visible.seats.length > 0 && remainingSeconds > 0 && !visible.pending && !visible.loading && !visible.error };
}
