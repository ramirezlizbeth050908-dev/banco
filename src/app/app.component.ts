import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { interval, startWith, switchMap } from 'rxjs';

interface Turno { id: number; folio: string; nombre: string; tramite: string; estado: 'espera'|'atendiendo'|'finalizado'; mesa: number|null; creado: string; }
interface Mesa { mesa: number; turno: Turno|null; }

@Component({ selector: 'app-root', standalone: true, imports: [CommonModule], template: `
<main class="shell">
  <header class="topbar"><div class="brand"><div class="brand-mark">N</div><div><strong>Atención a clientes</strong><small>Sistema de turnos</small></div></div><div class="live"><span></span> Sistema en línea <b>{{ now | date:'HH:mm' }}</b></div></header>
  <section class="welcome"><div><p class="eyebrow">CENTRO DE ATENCIÓN</p><h1>Gestión de turnos</h1><p class="sub">Administra la fila y la atención en tus cuatro mesas.</p></div><div class="summary"><span>EN ESPERA</span><strong>{{ waiting.length }}</strong><small>clientes</small></div></section>
  <section class="desk-grid"><article class="desk" *ngFor="let m of mesas; trackBy: trackByMesa"><div class="desk-head"><span>MESA {{ m.mesa }}</span><span class="badge" [class.busy]="m.turno">{{ m.turno ? 'EN ATENCIÓN' : 'DISPONIBLE' }}</span></div><ng-container *ngIf="m.turno; else free"><div class="current-label">TURNO ACTUAL</div><div class="folio">{{ m.turno.folio }}</div><div class="service">{{ m.turno.tramite }}</div><div class="actions"><button class="btn light" (click)="rellamar(m.turno!)">↻ Volver a llamar</button><button class="btn primary" (click)="finalizar(m.turno!)">Finalizar atención</button></div></ng-container><ng-template #free><div class="empty"><div class="empty-icon">＋</div><strong>Mesa disponible</strong><span>Lista para recibir al siguiente cliente</span></div><button class="btn primary full" [disabled]="!waiting.length" (click)="siguiente(m.mesa)">Llamar siguiente turno</button></ng-template></article></section>
  <section class="lower"><article class="panel queue"><div class="panel-title"><div><h2>Turnos en espera</h2><p>Se asignan por orden de llegada</p></div><span class="count">{{ waiting.length }}</span></div><div class="table-head"><span>TURNO</span><span>TRÁMITE</span><span>HORA</span><span>ESTADO</span></div><div class="queue-row" *ngFor="let t of waiting; trackBy: trackByTurno"><div><b>{{ t.folio }}</b></div><span>{{ t.tramite }}</span><span>{{ t.creado | date:'HH:mm' }}</span><span class="wait-chip">En espera</span></div><div class="no-queue" *ngIf="!waiting.length">No hay clientes esperando. Emite un turno para comenzar.</div></article>
  <article class="panel new-ticket"><div class="panel-title"><div><h2>Obtener turno</h2><p>Genera un turno al instante</p></div><div class="ticket-icon">＋</div></div><button class="btn primary full create" (click)="crear()" [disabled]="busy">{{ busy ? 'Generando…' : '＋  Obtener turno' }}</button><small class="hint">Recibirás un folio para tu atención.</small></article></section>
  <footer>Turnero de ventanilla <span>•</span> Atención ordenada, servicio cercano</footer>
  <div class="toast" *ngIf="message" (click)="message=''">{{ message }}</div>
</main>` })
export class AppComponent implements OnInit {
  private http = inject(HttpClient);
  mesas: Mesa[] = [1,2,3,4].map(mesa => ({ mesa, turno: null }));
  turnos: Turno[] = []; busy = false; message = ''; now = new Date();
  trackByMesa(_: number, mesa: Mesa): number { return mesa.mesa; }
  trackByTurno(_: number, turno: Turno): number { return turno.id; }
  get waiting(): Turno[] { return this.turnos.filter(t => t.estado === 'espera').sort((a,b) => new Date(a.creado).getTime()-new Date(b.creado).getTime() || a.id-b.id); }
  ngOnInit(): void { interval(3000).pipe(startWith(0), switchMap(() => this.http.get<Turno[]>('/api/turnos'))).subscribe({next: t => { this.turnos=t; this.now=new Date(); this.cargarMesas(); }, error: () => this.message='No se pudo conectar con el servidor.'}); }
  cargarMesas(): void { this.http.get<Mesa[]>('/api/mesas').subscribe({next: m => this.mesas=m}); }
  crear(): void { this.busy=true; this.http.post<Turno>('/api/turnos', {}).subscribe({next: t => {this.message=`Turno ${t.folio} asignado`;this.busy=false;this.actualizar();},error: e => {this.message=e.error?.detail||'No se pudo crear el turno';this.busy=false;}}); }
  siguiente(mesa:number): void { this.http.post<Turno>(`/api/mesas/${mesa}/siguiente`,{}).subscribe({next:t=>{this.message=`Llamando a ${t.folio} en mesa ${mesa}`;this.actualizar();},error:e=>this.message=e.error?.detail||'No se pudo llamar el turno'}); }
  finalizar(t:Turno): void { this.http.post<Turno>(`/api/turnos/${t.id}/finalizar`,{}).subscribe({next:()=>{this.message=`Atención de ${t.folio} finalizada`;this.actualizar();},error:e=>this.message=e.error?.detail||'No se pudo finalizar'}); }
  rellamar(t:Turno): void { this.http.post<Turno>(`/api/turnos/${t.id}/rellamar`,{}).subscribe({next:()=>this.message=`Volviendo a llamar ${t.folio}`,error:e=>this.message=e.error?.detail||'No se pudo llamar'}); }
  private actualizar(): void { this.http.get<Turno[]>('/api/turnos').subscribe(t=>this.turnos=t);this.cargarMesas(); }
}
