--
-- PostgreSQL database dump
--

\restrict dvPdEGemqmdPY2CbZcjzf3TObHjQubWBIy1Lky28iKbcjQJPjIs19c8Dq64rH4W

-- Dumped from database version 18.1 (Postgres.app)
-- Dumped by pg_dump version 18.1 (Postgres.app)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Account; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Account" (
    id text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at integer,
    token_type text,
    scope text,
    id_token text,
    session_state text
);


ALTER TABLE public."Account" OWNER TO postgres;

--
-- Name: Session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Session" OWNER TO postgres;

--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id text NOT NULL,
    name text,
    email text,
    "emailVerified" timestamp(3) without time zone,
    image text
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: UserMedia; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."UserMedia" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "externalId" text NOT NULL,
    source text NOT NULL,
    "mediaType" text NOT NULL,
    status text NOT NULL,
    progress integer NOT NULL,
    "totalEp" integer,
    score integer,
    title text,
    poster text,
    year integer,
    "originCountry" text,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    notes text,
    season integer DEFAULT 1 NOT NULL
);


ALTER TABLE public."UserMedia" OWNER TO postgres;

--
-- Name: VerificationToken; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."VerificationToken" (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."VerificationToken" OWNER TO postgres;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Data for Name: Account; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Account" (id, "userId", type, provider, "providerAccountId", refresh_token, access_token, expires_at, token_type, scope, id_token, session_state) FROM stdin;
\.


--
-- Data for Name: Session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Session" (id, "sessionToken", "userId", expires) FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, name, email, "emailVerified", image) FROM stdin;
mock-user-1	Mock User	mock@example.com	\N	\N
\.


--
-- Data for Name: UserMedia; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."UserMedia" (id, "userId", "externalId", source, "mediaType", status, progress, "totalEp", score, title, poster, year, "originCountry", "updatedAt", notes, season) FROM stdin;
cmkcgvzc5000bru35o0tjnfmf	mock-user-1	216310	TMDB	TV	Completed	12	12	10	Castaway Diva	https://image.tmdb.org/t/p/w500/csOKLKbiizE0mySOcim2gUugNHt.jpg	2023	KR	2026-01-13 10:46:56.933	\N	1
cmkcgwkpj000cru35dtoho521	mock-user-1	202318	TMDB	TV	Completed	16	16	8	Crash Course in Romance	https://image.tmdb.org/t/p/w500/88rQREli2xtoDV6HToJysp71ZL7.jpg	2023	KR	2026-01-13 10:47:24.631	\N	1
cmkcgwvlx000dru35rhci16tp	mock-user-1	94796	TMDB	TV	Completed	16	16	10	Crash Landing on You	https://image.tmdb.org/t/p/w500/gF3V98J6b4qvf1mAg3ti9ztGlIm.jpg	2019	KR	2026-01-13 10:47:38.757	\N	1
cmkcg1lmc00037z35g459ourz	mock-user-1	99654	TMDB	TV	Completed	16	16	10	18 Again	https://image.tmdb.org/t/p/w500/AwoC5PiNdi1RZTZTgOGGdHqCzrC.jpg	2020	KR	2026-01-13 10:23:28.693		1
cmkcgx752000eru35943wrwep	mock-user-1	134465	TMDB	TV	Completed	16	16	8	Crazy Love	https://image.tmdb.org/t/p/w500/wQmABWWAGsifRGn2nltTJRLEF3Y.jpg	2022	KR	2026-01-13 10:47:53.702	\N	1
cmkcgfw0j0005a135gktds59j	mock-user-1	215072	TMDB	TV	Completed	8	8	9	A Shop for Killers	https://image.tmdb.org/t/p/w500/7yUY1HUyQuybbvkAAhLzQ7x1l9g.jpg	2024	KR	2026-01-13 10:34:39.85		1
cmkcgxkx1000fru354ogyq7yp	mock-user-1	205319	TMDB	TV	Completed	12	12	9	Daily Dose of Sunshine	https://image.tmdb.org/t/p/w500/uMZBbAgS4TLMmejXRaWdMmENw6J.jpg	2023	KR	2026-01-13 10:48:11.557	\N	1
cmkcggtgy0006a13559ez9jpq	mock-user-1	614696	TMDB	MOVIE	Completed	1	1	8	#Alive	https://image.tmdb.org/t/p/w500/lZPvLUMYEPLTE2df1VW5FHTYC8N.jpg	2020	KR	2026-01-13 10:35:21.042		1
cmkcgm82d0000k43592cd37cg	mock-user-1	821661	TMDB	MOVIE	Completed	1	1	8	A Year-End Medley	https://image.tmdb.org/t/p/w500/ls9ljfJWqxYMKnQ4KgOLNFyzqDS.jpg	2021	KR	2026-01-13 10:39:21.685	\N	1
cmkcgms590001k435sk7f973x	mock-user-1	135157	TMDB	TV	Completed	20	20	10	Alchemy of Souls	https://image.tmdb.org/t/p/w500/q2IiPRSXPOZ6qVRj36WRAYEQyHs.jpg	2022	KR	2026-01-13 10:39:47.709	\N	1
cmkcgnht80003k4356qohao8b	mock-user-1	110316	TMDB	TV	Completed	8	8	10	Alice in Borderland	https://image.tmdb.org/t/p/w500/Ac8ruycRXzgcsndTZFK6ouGA0FA.jpg	2020	JP	2026-01-13 10:40:20.972	\N	1
cmkcfs4rr00007z35huu6t70w	mock-user-1	285278	TMDB	TV	Watching	7	12	0	Idol I	https://image.tmdb.org/t/p/w500/pKJLNbUh4uO2jwGsMfP4B37pamS.jpg	2025	KR	2026-01-13 10:18:21.925		1
cmkcfseat00017z35mijrbqw9	mock-user-1	280948	TMDB	TV	Watching	2	12	0	Spring Fever	https://image.tmdb.org/t/p/w500/50e9qtv8rKmcayAQSgB9P9XELpQ.jpg	2026	KR	2026-01-13 10:20:18.104		1
cmkcgqn9w0000ru35uorb3il0	mock-user-1	135157	TMDB	TV	Completed	10	10	10	Alchemy of Souls	https://image.tmdb.org/t/p/w500/i6XtaT8oiAkIKhN6LZgoau3BHic.jpg	2022	KR	2026-01-13 10:42:48.02	\N	2
cmkcgy2fs000gru35uallgvgz	mock-user-1	131026	TMDB	TV	Completed	16	16	9	Dali & Cocky Prince	https://image.tmdb.org/t/p/w500/2BuwNyTiMjlStKweY1VRIBsusRJ.jpg	2021	KR	2026-01-13 10:48:34.264	\N	1
cmkcgylc6000hru35oe00yb3p	mock-user-1	218230	TMDB	TV	Completed	8	8	10	Death's Game	https://image.tmdb.org/t/p/w500/fS4i7HHi1NNksTdAT8Vrvz9O161.jpg	2023	KR	2026-01-13 10:48:58.758	\N	1
cmkcgr7ry0001ru35zheyofv2	mock-user-1	110316	TMDB	TV	Completed	8	8	10	Alice in Borderland	https://image.tmdb.org/t/p/w500/s3ZAS0AGLQ668sFveVFinAd2zVy.jpg	2020	JP	2026-01-13 10:43:14.59	\N	2
cmkcgz40x000iru35vnar8xkj	mock-user-1	68890	TMDB	TV	Completed	18	18	9	Defendant	https://image.tmdb.org/t/p/w500/w0rk3tJhCWV22d4oKEdjU921MhJ.jpg	2017	KR	2026-01-13 10:49:22.977	\N	1
cmkcgzmlp000jru35zdqhnxgp	mock-user-1	215001	TMDB	TV	Completed	16	16	7	Destined with You	https://image.tmdb.org/t/p/w500/qK7HOzP9HGAAnjbVy52ptSPd75g.jpg	2023	KR	2026-01-13 10:49:47.053	\N	1
cmkcgzxzn000kru35m6422egu	mock-user-1	222233	TMDB	TV	Completed	16	16	8	Doctor Slump	https://image.tmdb.org/t/p/w500/iOWmbZEbhvrYyWm6O4W3oHf2S9B.jpg	2024	KR	2026-01-13 10:50:01.811	\N	1
cmkcgreit0002ru35m3b6b4oe	mock-user-1	110316	TMDB	TV	Completed	6	6	5	Alice in Borderland	https://image.tmdb.org/t/p/w500/1B1hllL2Fjap1f2EUsHjBqny3Kg.jpg	2020	JP	2026-01-13 10:43:23.333	\N	3
cmkcgs7hd0003ru35k8q6y56r	mock-user-1	66732	TMDB	TV	Completed	8	8	10	Stranger Things	https://image.tmdb.org/t/p/w500/hM6kowcLikwXnv2Eqv5XzKMaQz3.jpg	2016	US	2026-01-13 10:44:00.865	\N	1
cmkcgsdyx0004ru35xc70yvla	mock-user-1	66732	TMDB	TV	Completed	9	9	9	Stranger Things	https://image.tmdb.org/t/p/w500/74nFJmiapxKuUBXRbSu6VqGGcuo.jpg	2016	US	2026-01-13 10:44:09.273	\N	2
cmkcgsjc80005ru35rp46nk41	mock-user-1	66732	TMDB	TV	Completed	8	8	8	Stranger Things	https://image.tmdb.org/t/p/w500/x2LSRK2Cm7MZhjluni1msVJ3wDF.jpg	2016	US	2026-01-13 10:44:16.232	\N	3
cmkcgsp7d0006ru35t4fkspss	mock-user-1	66732	TMDB	TV	Completed	9	9	9	Stranger Things	https://image.tmdb.org/t/p/w500/zvGTZYDCoMSMIBkXExxRxLYimqN.jpg	2016	US	2026-01-13 10:44:23.833	\N	4
cmkcgsvx40007ru35dc3xt50d	mock-user-1	66732	TMDB	TV	Completed	8	8	7	Stranger Things	https://image.tmdb.org/t/p/w500/AaLrOh33YLkK1WLEB8Uml7FL8fm.jpg	2016	US	2026-01-13 10:44:32.536	\N	5
cmkcgtydc0008ru35zviv1bck	mock-user-1	280945	TMDB	TV	Completed	12	12	8	Bon Appétit, Your Majesty	https://image.tmdb.org/t/p/w500/5p6ZdgQAx1KySz1ybVLO9WLyMZo.jpg	2025	KR	2026-01-13 10:45:22.368	\N	1
cmkcguegf0009ru35grh9ayzk	mock-user-1	154825	TMDB	TV	Completed	12	12	10	Business Proposal	https://image.tmdb.org/t/p/w500/bdSnsLhfKcbi5YGLNSebVb9HhTS.jpg	2022	KR	2026-01-13 10:45:43.215	\N	1
cmkcgv4jp000aru353d3fsz6b	mock-user-1	238458	TMDB	TV	Completed	8	8	7	Cashero	https://image.tmdb.org/t/p/w500/vFMVeLpDO7zM6xnlYpy7McJboH4.jpg	2025	KR	2026-01-13 10:46:17.029	\N	1
cmkch0bg7000lru3504y17wzp	mock-user-1	116386	TMDB	TV	Completed	16	16	8	Doom at Your Service	https://image.tmdb.org/t/p/w500/6kAftlcSQcf7gOSXYzYwaI2GFPt.jpg	2021	KR	2026-01-13 10:50:19.255	\N	1
cmkch0kxw000mru35jxnk4to0	mock-user-1	281013	TMDB	TV	Completed	14	14	7	Dynamite Kiss	https://image.tmdb.org/t/p/w500/wXQEzvvFCHjHMKt0KYkvN6jz2wN.jpg	2025	KR	2026-01-13 10:50:31.556	\N	1
cmkch0upc000nru35lopc9no1	mock-user-1	197067	TMDB	TV	Completed	16	16	10	Extraordinary Attorney Woo	https://image.tmdb.org/t/p/w500/zuNOQVI4rEaqwknrfQUVKtlKE2C.jpg	2022	KR	2026-01-13 10:50:44.208	\N	1
cmkch143h000oru35ckhqwsj9	mock-user-1	93657	TMDB	TV	Completed	32	32	5	Extraordinary You	https://image.tmdb.org/t/p/w500/rwZN1LKFUgRX0ovZPTY7Wx65KU3.jpg	2019	KR	2026-01-13 10:50:56.381	\N	1
cmkch1es0000pru35c3cavwec	mock-user-1	237565	TMDB	TV	Completed	16	16	9	Family by Choice	https://image.tmdb.org/t/p/w500/723MT8RXN1GTlke7xl5JSQZLlY2.jpg	2024	KR	2026-01-13 10:51:10.224	\N	1
cmkch293w000qru35s5cn91ar	mock-user-1	236356	TMDB	TV	Completed	6	6	9	Family Matters	https://image.tmdb.org/t/p/w500/6VaSazLypWD3JPUKSnEkHBx2eZg.jpg	2024	KR	2026-01-13 10:51:49.532	\N	1
cmkch2j4p000rru35hgkaxhj6	mock-user-1	70813	TMDB	TV	Completed	16	16	8	Fight for My Way	https://image.tmdb.org/t/p/w500/mvAhZvG24h0mHeWT7K7IBiQYA0J.jpg	2017	KR	2026-01-13 10:52:02.521	\N	1
cmkch2s9k000sru35nzcgeibu	mock-user-1	99494	TMDB	TV	Completed	16	16	10	Flower of Evil	https://image.tmdb.org/t/p/w500/mR3x5AOZSOT4xuwDbrBvybITSEI.jpg	2020	KR	2026-01-13 10:52:14.36	\N	1
cmkch30gc000tru35u6dtvw2m	mock-user-1	197084	TMDB	TV	Completed	12	12	7	Gaus Electronics	https://image.tmdb.org/t/p/w500/hBAcIZ9rrWGQzhNnjzDIieRedYO.jpg	2022	KR	2026-01-13 10:52:24.972	\N	1
cmkch3c5k000uru35ywgvr6la	mock-user-1	228689	TMDB	TV	Completed	13	13	8	Genie, Make a Wish	https://image.tmdb.org/t/p/w500/9qzsM81upTLBXrW1Mae8GHVS0Jv.jpg	2025	KR	2026-01-13 10:52:40.136	\N	1
cmkch3kba000vru35i5vqdqaa	mock-user-1	231280	TMDB	TV	Completed	16	16	8	Good Boy	https://image.tmdb.org/t/p/w500/8FNRww84pPWCWByAzsUJjtm60HB.jpg	2025	KR	2026-01-13 10:52:50.71	\N	1
cmkch3uog000wru353fgqryq7	mock-user-1	258025	TMDB	TV	Completed	12	12	9	Head Over Heels	https://image.tmdb.org/t/p/w500/pwPK2DzhWp0W5SmiK2QmfmsfuNP.jpg	2025	KR	2026-01-13 10:53:04.144	\N	1
cmkch48rw000xru35z6du7jiy	mock-user-1	61670	TMDB	TV	Completed	20	20	9	Healer	https://image.tmdb.org/t/p/w500/hP41nfxLEOwiB5LfXR2DHBrTIf3.jpg	2014	KR	2026-01-13 10:53:22.412	\N	1
cmkch4kgn000yru35pm0cwvhh	mock-user-1	87553	TMDB	TV	Completed	16	16	9	Her Private Life	https://image.tmdb.org/t/p/w500/wXF2PfIya0xI51mVUa8Z7QBfKSE.jpg	2019	KR	2026-01-13 10:53:37.559	\N	1
cmkch53jb000zru35aas1fx52	mock-user-1	210733	TMDB	TV	Completed	25	25	9	Hidden Love	https://image.tmdb.org/t/p/w500/riGzESa9N9toumP9OhMmg0QvFPD.jpg	2023	CN	2026-01-13 10:54:02.279	\N	1
cmkch5kwl0010ru35xqbzp94s	mock-user-1	128883	TMDB	TV	Completed	16	16	8	Hometown Cha-Cha-Cha	https://image.tmdb.org/t/p/w500/7mtVm3hhYRlQeqcWE4ScHOoj9fL.jpg	2021	KR	2026-01-13 10:54:24.789	\N	1
cmkch62ip0011ru35wnlr7pdn	mock-user-1	96102	TMDB	TV	Completed	12	12	9	Hospital Playlist	https://image.tmdb.org/t/p/w500/2rxlNtPsAKFH7zIvFqFKZcqvIWW.jpg	2020	KR	2026-01-13 10:54:47.617	\N	1
cmkch67h90012ru353cl3ru8e	mock-user-1	96102	TMDB	TV	Completed	12	12	10	Hospital Playlist	https://image.tmdb.org/t/p/w500/7zhlpKM9IoVJn5Bo6mRIYoJ25oe.jpg	2020	KR	2026-01-13 10:54:54.045	\N	2
cmkch6kcb0013ru357tz740p9	mock-user-1	74682	TMDB	TV	Completed	32	32	9	I Am Not a Robot	https://image.tmdb.org/t/p/w500/qf2YQ3ZJBK4AG71XSnqDGhl9QaE.jpg	2017	KR	2026-01-13 10:55:10.715	\N	1
cmkch6sv60014ru35rvs8rm22	mock-user-1	96462	TMDB	TV	Completed	16	16	10	It's Okay to Not Be Okay	https://image.tmdb.org/t/p/w500/8XSJfLeImX8NszDUFnK1lbseCi8.jpg	2020	KR	2026-01-13 10:55:21.762	\N	1
cmkch71yx0015ru35f055wfj9	mock-user-1	62763	TMDB	TV	Completed	16	16	7	It's Okay, That's Love	https://image.tmdb.org/t/p/w500/jgQM7HwupKpNhCYYBgyZ5T7g6YT.jpg	2014	KR	2026-01-13 10:55:33.561	\N	1
cmkch7anx0016ru35hdg47oex	mock-user-1	112833	TMDB	TV	Completed	10	10	9	Juvenile Justice	https://image.tmdb.org/t/p/w500/mXMtMWTKnZKqmqeIKVKOFUAwEVN.jpg	2022	KR	2026-01-13 10:55:44.829	\N	1
cmkch7ng20017ru350xhwvzwt	mock-user-1	62266	TMDB	TV	Completed	20	20	9	Kill Me, Heal Me	https://image.tmdb.org/t/p/w500/pyYBzr7A1msB0af1uwfR0aUDpyP.jpg	2015	KR	2026-01-13 10:56:01.394	\N	1
cmkch7wgz0018ru354j1n20q5	mock-user-1	198004	TMDB	TV	Completed	16	16	9	King the Land	https://image.tmdb.org/t/p/w500/cyk3mrnj4iLdmKbgo0Qzo46laS0.jpg	2023	KR	2026-01-13 10:56:13.091	\N	1
cmkch85kp0019ru35n6mockpy	mock-user-1	803796	TMDB	MOVIE	Completed	1	1	8	KPop Demon Hunters	https://image.tmdb.org/t/p/w500/zT7Lhw3BhJbMkRqm9Zlx2YGMsY0.jpg	2025	US	2026-01-13 10:56:24.889	\N	1
cmkch8dz7001aru35zfgpaq0n	mock-user-1	241454	TMDB	TV	Completed	16	16	8	Love Next Door	https://image.tmdb.org/t/p/w500/gmMOdhUJwfbS29J75FIEDCP5npi.jpg	2024	KR	2026-01-13 10:56:35.779	\N	1
cmkch8t87001bru35wa8fmkx0	mock-user-1	233100	TMDB	TV	Completed	12	12	9	Love Scout	https://image.tmdb.org/t/p/w500/2FQisDBknp4tm4Af2zqdINqLPVS.jpg	2025	KR	2026-01-13 10:56:55.543	\N	1
cmkch92rj001cru35zgq9yr9i	mock-user-1	137094	TMDB	TV	Completed	10	10	8	Love to Hate You	https://image.tmdb.org/t/p/w500/kbfcnflR4FnfxvSnXR536V4FMUB.jpg	2023	KR	2026-01-13 10:57:07.903	\N	1
cmkch9aff001dru358nab14sr	mock-user-1	1355666	TMDB	MOVIE	Completed	1	1	9	Love Untangled	https://image.tmdb.org/t/p/w500/e7jStO2xfBUAUK37LbINHd1qtgy.jpg	2025	KR	2026-01-13 10:57:17.835	\N	1
cmkch9jod001eru35hdh7eabn	mock-user-1	230923	TMDB	TV	Completed	16	16	9	Lovely Runner	https://image.tmdb.org/t/p/w500/xJQyrif5M4UMoVBrBlwUabtaRxB.jpg	2024	KR	2026-01-13 10:57:29.821	\N	1
cmkch9v8z001fru354dzb3y4y	mock-user-1	125350	TMDB	TV	Completed	13	13	3	Mad for Each Other	https://image.tmdb.org/t/p/w500/1WYyc5JGs80huJUlzTXMAdKBVM7.jpg	2021	KR	2026-01-13 10:57:44.819	\N	1
cmkcha482001gru35q3f5awf7	mock-user-1	221851	TMDB	TV	Completed	16	16	9	Marry My Husband	https://image.tmdb.org/t/p/w500/JV3DXl1fITfoyHtyPzNuZyzh8q.jpg	2024	KR	2026-01-13 10:57:56.45	\N	1
cmkchakwf001hru35tr185pgb	mock-user-1	112836	TMDB	TV	Completed	12	12	8	Money Heist: Korea - Joint Economic Area	https://image.tmdb.org/t/p/w500/s7ChVSINrNLbw1pNLz0dUWR5x2L.jpg	2022	KR	2026-01-13 10:58:18.063	\N	1
cmkchauna001iru3527ds2s3w	mock-user-1	96571	TMDB	TV	Completed	10	10	7	Move to Heaven	https://image.tmdb.org/t/p/w500/k7gR0ceCuXOncYUYN9KTtZ4otBL.jpg	2021	KR	2026-01-13 10:58:30.694	\N	1
cmkchb3zz001jru35l5hiyxup	mock-user-1	126485	TMDB	TV	Completed	20	20	10	Moving	https://image.tmdb.org/t/p/w500/t1qdOoYg5miMgKN6tko6ruTFnLR.jpg	2023	KR	2026-01-13 10:58:42.815	\N	1
cmkchbdly001kru35kqo62424	mock-user-1	259015	TMDB	TV	Completed	12	12	7	My Dearest Nemesis	https://image.tmdb.org/t/p/w500/9sunLLFtHILviDCZIV1qtM1X5rd.jpg	2025	KR	2026-01-13 10:58:55.27	\N	1
cmkchbmi5001lru35u1rhkjod	mock-user-1	218539	TMDB	TV	Completed	16	16	7	My Demon	https://image.tmdb.org/t/p/w500/ciRcOqVWR4wiSQRPCPml1X9PaAp.jpg	2023	KR	2026-01-13 10:59:06.797	\N	1
cmkchbvzc001mru359lgff5fe	mock-user-1	80737	TMDB	TV	Completed	16	16	6	My ID is Gangnam Beauty	https://image.tmdb.org/t/p/w500/8mqvaz4onJEv0gfLGEWBAfVD9ew.jpg	2018	KR	2026-01-13 10:59:19.08	\N	1
cmkchcm0t001nru356kvr1wi1	mock-user-1	60957	TMDB	TV	Completed	21	21	8	My Love From Another Star	https://image.tmdb.org/t/p/w500/o5EYVYCVtDUdajP4rWfv6q0BTmm.jpg	2013	KR	2026-01-13 10:59:52.828	\N	1
cmkchcuf2001oru35ag7pmol9	mock-user-1	210781	TMDB	TV	Completed	16	16	8	My Lovely Liar	https://image.tmdb.org/t/p/w500/1qWg7KG3p2qbksnsHwi6esTbVjc.jpg	2023	KR	2026-01-13 11:00:03.71	\N	1
cmkchd2wt001pru35lgkbzz34	mock-user-1	114118	TMDB	TV	Completed	16	16	9	My Roommate Is a Gumiho	https://image.tmdb.org/t/p/w500/n9dT9QxKsGOWo92gbuiHj69GezI.jpg	2021	KR	2026-01-13 11:00:14.717	\N	1
cmkchdbcm001qru352o4l26vq	mock-user-1	215000	TMDB	TV	Completed	16	16	8	My Sweet Mobster	https://image.tmdb.org/t/p/w500/zlSvVgzBcVPx7cus93c3Amdb4py.jpg	2024	KR	2026-01-13 11:00:25.654	\N	1
cmkchdlml001rru35wf0is473	mock-user-1	229480	TMDB	TV	Completed	12	12	6	No Gain No Love	https://image.tmdb.org/t/p/w500/jiGxkMP3lzPDaPw4F0EZAEiTSgL.jpg	2024	KR	2026-01-13 11:00:38.973	\N	1
cmkchdtex001sru35swx0k1ae	mock-user-1	64320	TMDB	TV	Completed	16	16	6	Oh My Venus	https://image.tmdb.org/t/p/w500/wbcLkkcsnDqN3w4BvT7uEtFPESS.jpg	2015	KR	2026-01-13 11:00:49.065	\N	1
cmkchebu8001tru35nxgxc20o	mock-user-1	111110	TMDB	TV	Completed	8	8	10	ONE PIECE	https://image.tmdb.org/t/p/w500/asDyEsFKceLkVE4SESYQlvL5Oov.jpg	2023	US	2026-01-13 11:01:12.944	\N	1
cmkchekk2001uru35swy6lr7v	mock-user-1	261980	TMDB	TV	Completed	12	12	9	Our Unwritten Seoul	https://image.tmdb.org/t/p/w500/4wnCkk4HmIzBuyyFGpcGxPKsyjI.jpg	2025	KR	2026-01-13 11:01:24.242	\N	1
cmkchexkz001vru355wcv33mp	mock-user-1	496243	TMDB	MOVIE	Completed	1	1	9	Parasite	https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg	2019	KR	2026-01-13 11:01:41.123	\N	1
cmkchfn2r001wru355y4svy18	mock-user-1	230524	TMDB	TV	Completed	12	12	9	Perfect Marriage Revenge	https://image.tmdb.org/t/p/w500/5iqVjyWAfXAFMim0Fi5QS6jUNPq.jpg	2023	KR	2026-01-13 11:02:14.163	\N	1
cmkchgn5800001g35cktwrb7x	mock-user-1	284744	TMDB	TV	Completed	12	12	9	Pro Bono	https://image.tmdb.org/t/p/w500/rxG671iquYlLSNJUy0nXf7K48B7.jpg	2025	KR	2026-01-13 11:03:00.908	\N	1
cmkchgy6a00011g35oz42yr5w	mock-user-1	227192	TMDB	TV	Completed	10	10	8	Pyramid Game	https://image.tmdb.org/t/p/w500/pBUERwWNCuO36CPxiVFsoQCPu7W.jpg	2024	KR	2026-01-13 11:03:15.202	\N	1
cmkchh7qd00021g35567z3pe7	mock-user-1	215720	TMDB	TV	Completed	16	16	10	Queen of Tears	https://image.tmdb.org/t/p/w500/7ZXLZ3KYL3IVvsSHBZaHjcNQzNU.jpg	2024	KR	2026-01-13 11:03:27.589	\N	1
cmkchhgw100031g358wmvq4ld	mock-user-1	125437	TMDB	TV	Completed	16	16	10	Racket Boys	https://image.tmdb.org/t/p/w500/5yyn2fWvo8GpHZOeUqpunuGlFsv.jpg	2021	KR	2026-01-13 11:03:39.457	\N	1
cmkchhqir00041g3525zpdaeu	mock-user-1	153496	TMDB	TV	Completed	16	16	9	Reborn Rich	https://image.tmdb.org/t/p/w500/qSk53QQ62xEKPdJJopTVNudNtGM.jpg	2022	KR	2026-01-13 11:03:51.939	\N	1
cmkchig0900051g35l15zygxm	mock-user-1	155441	TMDB	TV	Completed	15	15	10	Reset	https://image.tmdb.org/t/p/w500/k2Tkn1MdarvyMvr7GGvzqqC5xxG.jpg	2022	CN	2026-01-13 11:04:24.968	\N	1
cmkchio8q00061g35bz826adm	mock-user-1	235355	TMDB	TV	Completed	12	12	9	Resident Playbook	https://image.tmdb.org/t/p/w500/t7yzNoqXWkww8mSjEgYHIBekQDR.jpg	2025	KR	2026-01-13 11:04:35.642	\N	1
cmkchiz7900071g35le4tc1jw	mock-user-1	208336	TMDB	TV	Completed	12	12	8	Revenge of Others	https://image.tmdb.org/t/p/w500/ccej6D8J81DDJWqhP7OG6PA6xcl.jpg	2022	KR	2026-01-13 11:04:49.845	\N	1
cmkchj9eu00081g35xo6mfff1	mock-user-1	113240	TMDB	TV	Completed	16	16	7	Run On	https://image.tmdb.org/t/p/w500/vAyRESxxid2fG82Jre6xASNnXs2.jpg	2020	KR	2026-01-13 11:05:03.078	\N	1
cmkchjih700091g35ph3k84bo	mock-user-1	136732	TMDB	TV	Completed	16	16	8	Shooting Stars	https://image.tmdb.org/t/p/w500/pizsEzwkIUEkmOfKEPzs6gXEhvE.jpg	2022	KR	2026-01-13 11:05:14.827	\N	1
cmkchjq0v000a1g35b8sef3yu	mock-user-1	67802	TMDB	TV	Completed	16	16	6	Something About 1%	https://image.tmdb.org/t/p/w500/n18qnhg0fDKG2ICIKDqf8MKcNrr.jpg	2016	KR	2026-01-13 11:05:24.607	\N	1
cmkchk20c000b1g35slswuegc	mock-user-1	223896	TMDB	TV	Completed	12	12	9	Spirit Fingers	https://image.tmdb.org/t/p/w500/bmDA5GkQTGwjxf0xxNSaTiFSQJK.jpg	2025	KR	2026-01-13 11:05:40.14	\N	1
cmkchkcyt000c1g35y246d6qo	mock-user-1	93405	TMDB	TV	Completed	9	9	9	Squid Game	https://image.tmdb.org/t/p/w500/jlbrV1Kl4Y8pWXu12SppebRs7On.jpg	2021	KR	2026-01-13 11:05:54.341	\N	1
cmkchkhu6000d1g3599evptqc	mock-user-1	93405	TMDB	TV	Completed	7	7	9	Squid Game	https://image.tmdb.org/t/p/w500/sXZhtWLo3fecavpDuOyJiayjt32.jpg	2021	KR	2026-01-13 11:06:00.653	\N	2
cmkchkmut000e1g35exfwf1ym	mock-user-1	93405	TMDB	TV	Completed	6	6	8	Squid Game	https://image.tmdb.org/t/p/w500/6VZsJ37aJDvf45PLJk7Z0UVhzxt.jpg	2021	KR	2026-01-13 11:06:07.157	\N	3
cmkchkvrn000f1g3599fm39wg	mock-user-1	80919	TMDB	TV	Completed	32	32	10	Still 17	https://image.tmdb.org/t/p/w500/kG7KvojrOWnqfwevVInn8b99Vzm.jpg	2018	KR	2026-01-13 11:06:18.707	\N	1
cmkchl5wd000g1g3550a71fc2	mock-user-1	68814	TMDB	TV	Completed	16	16	9	Strong Woman Do Bong-Soon	https://image.tmdb.org/t/p/w500/kTIppGMDuCqysaRK3mI9kqK7KRO.jpg	2017	KR	2026-01-13 11:06:31.837	\N	1
cmkchlf2s000h1g35h60fwl8v	mock-user-1	233347	TMDB	TV	Completed	10	10	10	Study Group	https://image.tmdb.org/t/p/w500/mZfDO3QJYoW9cI8fFGHpE7vpeuv.jpg	2025	KR	2026-01-13 11:06:43.732	\N	1
cmkchlr74000i1g356xs6gl0h	mock-user-1	96648	TMDB	TV	Completed	10	10	9	Sweet Home	https://image.tmdb.org/t/p/w500/2hnEMvi6NTzRSGzzurKfyKv7Tgu.jpg	2020	KR	2026-01-13 11:06:59.44	\N	1
cmkchm0kp000j1g350d0teksh	mock-user-1	95396	TMDB	TV	Watching	5	9	\N	Severance	https://image.tmdb.org/t/p/w500/lFf6LLrQjYldcZItzOkGmMMigP7.jpg	2022	US	2026-01-13 11:07:11.593	\N	1
cmkchmlej000k1g35r4uvu1mt	mock-user-1	119769	TMDB	TV	Completed	16	16	10	Taxi Driver	https://image.tmdb.org/t/p/w500/xnNUmtYA9Hjz4c604MNb7itFmP1.jpg	2021	KR	2026-01-13 11:07:38.587	\N	1
cmkchmq3q000l1g358sb7xxyx	mock-user-1	119769	TMDB	TV	Completed	16	16	10	Taxi Driver	https://image.tmdb.org/t/p/w500/gYXs0NIcFPxJrpI885y96RG8uUK.jpg	2021	KR	2026-01-13 11:07:44.678	\N	2
cmkchmuxf000m1g353h7mmd5s	mock-user-1	119769	TMDB	TV	Completed	16	16	9	Taxi Driver	https://image.tmdb.org/t/p/w500/6uRbmbzB029xyRhwC5tIenEmRkU.jpg	2021	KR	2026-01-13 11:07:50.931	\N	3
cmkchn4uv000n1g35eqruoo3j	mock-user-1	232616	TMDB	TV	Completed	12	12	9	The Atypical Family	https://image.tmdb.org/t/p/w500/AnoQxxH3RoMRrUj5fm9SFRYlfxP.jpg	2024	KR	2026-01-13 11:08:03.799	\N	1
cmkchngwa000o1g35pqk6cnds	mock-user-1	119772	TMDB	TV	Completed	16	16	9	The Devil Judge	https://image.tmdb.org/t/p/w500/nPn7nPzWDXTzqwnQt2Jq9t8e3Ae.jpg	2021	KR	2026-01-13 11:08:19.402	\N	1
cmkchodyi000p1g35edl3zru8	mock-user-1	250060	TMDB	TV	Completed	32	32	9	The First Frost	https://image.tmdb.org/t/p/w500/wkttQOn4m9XlWksyOuHCmlKqbet.jpg	2025	CN	2026-01-13 11:09:02.25	\N	1
cmkchoq88000q1g35yncxsl3p	mock-user-1	136283	TMDB	TV	Completed	16	16	10	The Glory	https://image.tmdb.org/t/p/w500/uS2dQ7ukij2ifLwjMBzTjqEDg2x.jpg	2022	KR	2026-01-13 11:09:18.152	\N	1
cmkchp5xs000r1g35zjz0toe8	mock-user-1	202625	TMDB	TV	Completed	12	12	2	The Heavenly Idol	https://image.tmdb.org/t/p/w500/vOpXfxUcl79JVtA6W3V43FT3MEm.jpg	2023	KR	2026-01-13 11:09:38.512	\N	1
cmkchpes4000s1g35ws3zizj9	mock-user-1	235577	TMDB	TV	Completed	14	14	10	The Judge from Hell	https://image.tmdb.org/t/p/w500/rlgv02MD3sMvjZXozR9cBZ7nTVA.jpg	2024	KR	2026-01-13 11:09:49.972	\N	1
cmkchpnce000t1g351g55f3tt	mock-user-1	154523	TMDB	TV	Completed	12	12	9	The King of Pigs	https://image.tmdb.org/t/p/w500/z494Y7XFl4GKofLeNnjr1amyphr.jpg	2022	KR	2026-01-13 11:10:01.07	\N	1
cmkchq0kw000u1g35ql5oz9yb	mock-user-1	156248	TMDB	TV	Dropped	3	16	0	The Law Cafe	https://image.tmdb.org/t/p/w500/lFdwrnhuo274ud6Qzf1D3hvSmmq.jpg	2022	KR	2026-01-13 11:10:18.224	\N	1
cmkchqeut000v1g35dsmdx6o1	mock-user-1	239385	TMDB	TV	Completed	12	12	8	The Manipulated	https://image.tmdb.org/t/p/w500/4wBdxk1nadZfv2OQ2FzG4OVkWdF.jpg	2025	KR	2026-01-13 11:10:36.725	\N	1
cmkchr22k000w1g35j24u3alb	mock-user-1	220076	TMDB	TV	Completed	12	12	7	The Story of Park's Marriage Contract	https://image.tmdb.org/t/p/w500/yxEMQxm3PAShuVwlXm4wd828K4Z.jpg	2023	KR	2026-01-13 11:11:06.812	\N	1
cmkchrd0y000x1g356g9e40fk	mock-user-1	217553	TMDB	TV	Completed	8	8	10	The Trauma Code: Heroes on Call	https://image.tmdb.org/t/p/w500/A5rMphiIA0Sgs9j0Elkx2P4OgFh.jpg	2025	KR	2026-01-13 11:11:21.01	\N	1
cmkchrpbs000y1g3571bz2cn1	mock-user-1	113268	TMDB	TV	Completed	16	16	10	The Uncanny Counter	https://image.tmdb.org/t/p/w500/18T2WcsGLuNN7a5Jp0pQ2ImZWuT.jpg	2020	KR	2026-01-13 11:11:36.952	\N	1
cmkchrv6k000z1g35bflqfhqf	mock-user-1	250463	TMDB	TV	Completed	12	12	9	The Winning Try	https://image.tmdb.org/t/p/w500/8hCYIhjr79V7QaIvHoixYb3J1qK.jpg	2025	KR	2026-01-13 11:11:44.54	\N	1
cmkchs6i100101g35goep42oi	mock-user-1	146102	TMDB	TV	Dropped	2	12	\N	Through the Darkness	https://image.tmdb.org/t/p/w500/6QVQEp3PUbid8zHm1kVniAYIkLP.jpg	2022	KR	2026-01-13 11:11:59.209	\N	1
cmkchsg1100111g357vghyjnj	mock-user-1	136369	TMDB	TV	Completed	16	16	10	Tomorrow	https://image.tmdb.org/t/p/w500/7pOC2Wr6aavn6OPkFJ9YqhCV5hW.jpg	2022	KR	2026-01-13 11:12:11.557	\N	1
cmkchst7w00121g35f7kl2c1q	mock-user-1	85404	TMDB	TV	Completed	16	16	9	Touch Your Heart	https://image.tmdb.org/t/p/w500/pZ8LwSL9qrM1QLQWP04P7e7VK8R.jpg	2019	KR	2026-01-13 11:12:28.652	\N	1
cmkcht4cg00131g35pa8y3szt	mock-user-1	396535	TMDB	MOVIE	Completed	1	1	9	Train to Busan	https://image.tmdb.org/t/p/w500/vNVFt6dtcqnI7hqa6LFBUibuFiw.jpg	2016	KR	2026-01-13 11:12:43.072	\N	1
cmkchtded00141g358f5compx	mock-user-1	112888	TMDB	TV	Completed	16	16	8	True Beauty	https://image.tmdb.org/t/p/w500/7Xmp7ykz9vH4cUyiarkTV4q0FYE.jpg	2020	KR	2026-01-13 11:12:54.805	\N	1
cmkchtnnz00151g35l2h6g5xu	mock-user-1	212204	TMDB	TV	Completed	16	16	10	Twinkling Watermelon	https://image.tmdb.org/t/p/w500/m56EaJ4zLG84F8jpNT7ZmaL0IAS.jpg	2023	KR	2026-01-13 11:13:08.111	\N	1
cmkchtvnb00161g35yc16iq4k	mock-user-1	248244	TMDB	TV	Completed	12	12	8	Undercover High School	https://image.tmdb.org/t/p/w500/AfIHFoByUqMOaluHRXOkV8JiXtJ.jpg	2025	KR	2026-01-13 11:13:18.455	\N	1
cmkchulas00171g35ijd5pfdg	mock-user-1	117376	TMDB	TV	Completed	20	20	10	Vincenzo	https://image.tmdb.org/t/p/w500/vvOr94SYrcUsfNaPMeeqeXTN34h.jpg	2021	KR	2026-01-13 11:13:51.7	\N	1
cmkchutne00181g35jvvrmmhn	mock-user-1	200709	TMDB	TV	Completed	8	8	10	Weak Hero	https://image.tmdb.org/t/p/w500/xRw3akJQdfgqx0x4fiHW7nIkEUJ.jpg	2022	KR	2026-01-13 11:14:02.522	\N	1
cmkchuz0j00191g35lhiab1nc	mock-user-1	200709	TMDB	TV	Completed	8	8	8	Weak Hero	https://image.tmdb.org/t/p/w500/aW7mGixv2dZdQtbve4deYyfewHH.jpg	2022	KR	2026-01-13 11:14:09.475	\N	2
cmkchv7vx001a1g35w5efu390	mock-user-1	68349	TMDB	TV	Completed	16	16	9	Weightlifting Fairy Kim Bok-joo	https://image.tmdb.org/t/p/w500/cfjJCdaxa6PehFrpPp4lLQlqi8i.jpg	2016	KR	2026-01-13 11:14:20.973	\N	1
cmkchvfwk001b1g35gmev4w6t	mock-user-1	219651	TMDB	TV	Completed	16	16	9	Welcome to Samdal-ri	https://image.tmdb.org/t/p/w500/98IvA2i0PsTY8CThoHByCKOEAjz.jpg	2023	KR	2026-01-13 11:14:31.364	\N	1
cmkchvqjk001c1g35jgr2r3z6	mock-user-1	76557	TMDB	TV	Completed	20	20	8	Welcome to Waikiki	https://image.tmdb.org/t/p/w500/cB0x31CoTSbv87BLz95wQpcaCD0.jpg	2018	KR	2026-01-13 11:14:45.152	\N	1
cmkchvyp1001d1g3548kgi7ec	mock-user-1	79434	TMDB	TV	Completed	16	16	9	What's Wrong with Secretary Kim	https://image.tmdb.org/t/p/w500/yEiBITQyWbS2FMjdMjnICILIH6.jpg	2018	KR	2026-01-13 11:14:55.717	\N	1
cmkchw8lo001e1g35a9ik5m75	mock-user-1	228547	TMDB	TV	Completed	24	24	10	When I Fly Towards You	https://image.tmdb.org/t/p/w500/4rcykytUTISe2aQR6WTzC0vRitC.jpg	2023	CN	2026-01-13 11:15:08.556	\N	1
cmkchwig1001f1g35vng7snz8	mock-user-1	253905	TMDB	TV	Completed	12	12	8	When the Phone Rings	https://image.tmdb.org/t/p/w500/glWP5Y7CVeqrOjJpLckQjuLFjQJ.jpg	2024	KR	2026-01-13 11:15:21.313	\N	1
cmkchwsom001g1g35h8omnkmi	mock-user-1	70649	TMDB	TV	Completed	32	32	10	While You Were Sleeping	https://image.tmdb.org/t/p/w500/64HIcFGI8in07NDNpNqLbgRC8lh.jpg	2017	KR	2026-01-13 11:15:34.582	\N	1
cmkchwyui001h1g35003uv1or	mock-user-1	127493	TMDB	TV	Completed	32	32	8	You Are My Glory	https://image.tmdb.org/t/p/w500/noK5oeHFyP5IPoF8IoQv29HzrmR.jpg	2021	CN	2026-01-13 11:15:42.57	\N	1
cmkcq9fqu0000dp359tvwc2yz	mock-user-1	215072	TMDB	TV	Plan to Watch	0	6	\N	A Shop for Killers	https://image.tmdb.org/t/p/w500/7yUY1HUyQuybbvkAAhLzQ7x1l9g.jpg	2024	KR	2026-01-13 15:09:21.269	\N	2
cmkcq9tyn0001dp3598wbpd47	mock-user-1	281016	TMDB	TV	Plan to Watch	0	1	\N	Boyfriend on Demand	https://image.tmdb.org/t/p/w500/5gyTfmPFQhpsSMXonXEdsDXRimH.jpg	\N	KR	2026-01-13 15:09:39.695	\N	1
cmkcqag0k0002dp357tjjaty5	mock-user-1	229891	TMDB	TV	Plan to Watch	0	12	\N	Can This Love Be Translated?	https://image.tmdb.org/t/p/w500/5zLhr25pXx8j7hfIis21fPGIeWI.jpg	2026	KR	2026-01-13 15:10:08.276	\N	1
cmkcqapnd0003dp35hk0xykpz	mock-user-1	293610	TMDB	TV	Plan to Watch	0	8	\N	Doctor X: Age of the White Mafia	\N	\N	KR	2026-01-13 15:10:20.76	\N	1
cmkcqaw050004dp35aml8okl0	mock-user-1	68398	TMDB	TV	Plan to Watch	0	20	\N	Dr. Romantic	https://image.tmdb.org/t/p/w500/5WC5zEItQk7Av75osRRjbcKfHWD.jpg	2016	KR	2026-01-13 15:10:28.997	\N	1
cmkcqbdh90005dp35110nrld6	mock-user-1	301412	TMDB	TV	Plan to Watch	0	1	\N	Dream to You	\N	\N	KR	2026-01-13 15:10:51.645	\N	1
cmkcqbj7c0006dp35m6g3ot2x	mock-user-1	297712	TMDB	TV	Plan to Watch	0	1	\N	Fifties Professionals	\N	\N	KR	2026-01-13 15:10:59.064	\N	1
cmkcqbxdi0007dp353yo8kwtd	mock-user-1	278113	TMDB	TV	Plan to Watch	0	1	\N	Gold Land	https://image.tmdb.org/t/p/w500/xnWEK819Uxnx8UKp3WN7bE2rfXa.jpg	\N	KR	2026-01-13 15:11:17.43	\N	1
cmkcqc3zo0008dp35s6dkrwfm	mock-user-1	95484	TMDB	TV	Plan to Watch	0	16	\N	Stove League	https://image.tmdb.org/t/p/w500/wRItaA5mCd0kS3AXxa46IuRrwLL.jpg	2019	KR	2026-01-13 15:11:26.004	\N	1
cmkcqcfr60009dp354krj3gdt	mock-user-1	233833	TMDB	TV	Plan to Watch	0	12	\N	In Your Brilliant Season	\N	2026	KR	2026-01-13 15:11:41.25	\N	1
cmkcqcmpu000adp35bp54xfdy	mock-user-1	226529	TMDB	TV	Plan to Watch	0	8	\N	Light Shop	https://image.tmdb.org/t/p/w500/iRgH73xibpeNZ8zzPDkIpxuoKgC.jpg	2024	KR	2026-01-13 15:11:50.274	\N	1
cmkcqcs3b000bdp358fctlp9z	mock-user-1	270420	TMDB	TV	Plan to Watch	0	12	\N	No Tail to Tell	https://image.tmdb.org/t/p/w500/bSX49M4tjDsnC8dOVQxt1sLgH6z.jpg	2026	KR	2026-01-13 15:11:57.239	\N	1
cmkcqcxul000cdp35902ez7pl	mock-user-1	201852	TMDB	TV	Plan to Watch	0	12	\N	One Dollar Lawyer	https://image.tmdb.org/t/p/w500/AoyepneE9LkLSlVKdJb33mcXfFe.jpg	2022	KR	2026-01-13 15:12:04.701	\N	1
cmkcqd3f2000ddp355yq2lymm	mock-user-1	278573	TMDB	TV	Plan to Watch	0	1	\N	Perfect Crown	\N	\N	KR	2026-01-13 15:12:11.918	\N	1
cmkcqd9v0000edp35to6ca0kr	mock-user-1	295389	TMDB	TV	Plan to Watch	0	1	\N	Solo Leveling	\N	\N	KR	2026-01-13 15:12:20.268	\N	1
cmkcqdmzx000fdp35bhm7sbjm	mock-user-1	71349	TMDB	TV	Plan to Watch	0	40	\N	Suspicious Partner	https://image.tmdb.org/t/p/w500/qWOzam1f7znVtHaama3R6I8jdTJ.jpg	2017	KR	2026-01-13 15:12:37.293	\N	1
cmkcqdtq5000gdp35iicu2ppr	mock-user-1	238673	TMDB	TV	Plan to Watch	0	8	\N	The Defects	https://image.tmdb.org/t/p/w500/mfq3Otg6yKmg8vbTozLgsQPcuqy.jpg	2025	KR	2026-01-13 15:12:46.013	\N	1
cmkcqe5y0000hdp3595jp0dw1	mock-user-1	209110	TMDB	TV	Plan to Watch	0	12	\N	The Price of Confession	https://image.tmdb.org/t/p/w500/jF2Y58uqXv94iOUAyUQOFYTcFP5.jpg	2025	KR	2026-01-13 15:13:01.848	\N	1
cmkcqebg8000idp35ka0alcib	mock-user-1	259837	TMDB	TV	Plan to Watch	0	1	\N	The WONDERfools	\N	\N	KR	2026-01-13 15:13:08.984	\N	1
cmkcqeic7000jdp351iv69jh0	mock-user-1	293608	TMDB	TV	Plan to Watch	0	16	\N	Undercover Miss Hong	https://image.tmdb.org/t/p/w500/bZr3i8yczHGDzyqZQ9oOArEEVON.jpg	2026	KR	2026-01-13 15:13:17.911	\N	1
cmkcqeom8000kdp35ixsma6gf	mock-user-1	239077	TMDB	TV	Plan to Watch	0	6	\N	Way Back Love	https://image.tmdb.org/t/p/w500/vjptGHe4Ji44e0Mgf5077kn3Oz5.jpg	2025	KR	2026-01-13 15:13:26.048	\N	1
cmkcqexnv000ldp35jalgu5g1	mock-user-1	219246	TMDB	TV	Plan to Watch	0	16	\N	When Life Gives You Tangerines	https://image.tmdb.org/t/p/w500/q29q6AByug53pnylCytwLA7m6AY.jpg	2025	KR	2026-01-13 15:13:37.771	\N	1
cmkcqf604000mdp35sd7ykt8i	mock-user-1	279388	TMDB	TV	Plan to Watch	0	40	\N	Chasing Jade	https://image.tmdb.org/t/p/w500/8ydrPpuinGdgVId1ssT8cHIEsCm.jpg	\N	CN	2026-01-13 15:13:48.58	\N	1
cmkcqx8ek000ndp35boq90wxk	mock-user-1	124364	TMDB	TV	Completed	10	10	\N	FROM	https://image.tmdb.org/t/p/w500/ps46NdLlH70ptDD8ailTL8TCZU3.jpg	2022	US	2026-01-13 15:27:51.5	\N	1
cmkcqxesu000odp35ddesrk79	mock-user-1	124364	TMDB	TV	Completed	10	10	\N	FROM	https://image.tmdb.org/t/p/w500/cJmfLHnF95XkoIr9as2bBK5cPeK.jpg	2022	US	2026-01-13 15:27:59.79	\N	2
cmkcr3a0n000pdp35ijdb6pr4	mock-user-1	1399	TMDB	TV	Completed	10	10	\N	Game of Thrones	https://image.tmdb.org/t/p/w500/wgfKiqzuMrFIkU1M68DDDY8kGC1.jpg	2011	US	2026-01-13 15:32:33.527	\N	1
cmkcr3fch000qdp35h8owno3n	mock-user-1	1399	TMDB	TV	Completed	10	10	\N	Game of Thrones	https://image.tmdb.org/t/p/w500/9xfNkPwDOqyeUvfNhs1XlWA0esP.jpg	2011	US	2026-01-13 15:32:40.433	\N	2
cmkcr3rgi000rdp354rap3yof	mock-user-1	1399	TMDB	TV	Completed	10	10	\N	Game of Thrones	https://image.tmdb.org/t/p/w500/5MkZjRnCKiIGn3bkXrXfndEzqOU.jpg	2011	US	2026-01-13 15:32:56.13	\N	3
cmkcr3vha000sdp35c233jsip	mock-user-1	1399	TMDB	TV	Completed	10	10	\N	Game of Thrones	https://image.tmdb.org/t/p/w500/jXIMScXE4J4EVHUba1JgxZnWbo4.jpg	2011	US	2026-01-13 15:33:01.342	\N	4
cmkcr415h000tdp350vu70yyj	mock-user-1	1399	TMDB	TV	Completed	10	10	\N	Game of Thrones	https://image.tmdb.org/t/p/w500/7Q1Hy1AHxAzA2lsmzEMBvuWTX0x.jpg	2011	US	2026-01-13 15:33:08.693	\N	5
cmkcr45sr000udp35qjvl13hu	mock-user-1	1399	TMDB	TV	Completed	10	10	\N	Game of Thrones	https://image.tmdb.org/t/p/w500/p1udLh0gfqyZFmXBGa393gk8go5.jpg	2011	US	2026-01-13 15:33:14.715	\N	6
cmkcr49sb000vdp35cvgx65ri	mock-user-1	1399	TMDB	TV	Completed	7	7	\N	Game of Thrones	https://image.tmdb.org/t/p/w500/oX51n32QyHeFP5kErksemJsJljL.jpg	2011	US	2026-01-13 15:33:19.883	\N	7
cmkcr4eoz000wdp35gzypmwql	mock-user-1	1399	TMDB	TV	Completed	6	6	\N	Game of Thrones	https://image.tmdb.org/t/p/w500/259Q5FuaD3TNB7DGauTaJVRC8XV.jpg	2011	US	2026-01-13 15:33:26.243	\N	8
cmkcr4zyw000xdp35al2nelgp	mock-user-1	1396	TMDB	TV	Completed	7	7	\N	Breaking Bad	https://image.tmdb.org/t/p/w500/1BP4xYv9ZG4ZVHkL7ocOziBbSYH.jpg	2008	US	2026-01-13 15:33:53.816	\N	1
cmkcr5456000ydp35p1qxkk9h	mock-user-1	1396	TMDB	TV	Completed	13	13	\N	Breaking Bad	https://image.tmdb.org/t/p/w500/e3oGYpoTUhOFK0BJfloru5ZmGV.jpg	2008	US	2026-01-13 15:33:59.226	\N	2
cmkcr58vn000zdp356ruicqu7	mock-user-1	1396	TMDB	TV	Completed	13	13	\N	Breaking Bad	https://image.tmdb.org/t/p/w500/ffP8Q8ew048YofHRnFVM18B2fPG.jpg	2008	US	2026-01-13 15:34:05.363	\N	3
cmkcr5ce90010dp353ahj827w	mock-user-1	1396	TMDB	TV	Completed	13	13	\N	Breaking Bad	https://image.tmdb.org/t/p/w500/5ewrnKp4TboU4hTLT5cWO350mHj.jpg	2008	US	2026-01-13 15:34:09.921	\N	4
cmkcr5gqc0011dp35b1yr2v11	mock-user-1	1396	TMDB	TV	Completed	16	16	\N	Breaking Bad	https://image.tmdb.org/t/p/w500/r3z70vunihrAkjILQKWHX0G2xzO.jpg	2008	US	2026-01-13 15:34:15.54	\N	5
cmkcr7mk40012dp35v0lvjg5h	mock-user-1	76479	TMDB	TV	Completed	8	8	\N	The Boys	https://image.tmdb.org/t/p/w500/iikrapejulhIvbNgUjj468mUE0I.jpg	2019	US	2026-01-13 15:35:56.404	\N	1
cmkcr7qtb0013dp35luwfs1sw	mock-user-1	76479	TMDB	TV	Completed	8	8	\N	The Boys	https://image.tmdb.org/t/p/w500/9rXhd3cVMcMDlhqrgWkuQVsNkVF.jpg	2019	US	2026-01-13 15:36:01.919	\N	2
cmkcr7v4m0014dp35a5xta8sr	mock-user-1	76479	TMDB	TV	Completed	8	8	\N	The Boys	https://image.tmdb.org/t/p/w500/7Ns6tO3aYjppI5bFhyYZurOYGBT.jpg	2019	US	2026-01-13 15:36:07.51	\N	3
cmkcr7zue0015dp35efnvuph2	mock-user-1	76479	TMDB	TV	Completed	8	8	\N	The Boys	https://image.tmdb.org/t/p/w500/nWwhdt7iOFJsWM8Lz1UtaUC6EUf.jpg	2019	US	2026-01-13 15:36:13.622	\N	4
cmkcr88i70016dp35natq93d3	mock-user-1	76479	TMDB	TV	Plan to Watch	0	8	\N	The Boys	https://image.tmdb.org/t/p/w500/eCgTR8V0hP8blcZWg9EMalu5Yxh.jpg	2019	US	2026-01-13 15:36:24.847	\N	5
\.


--
-- Data for Name: VerificationToken; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."VerificationToken" (identifier, token, expires) FROM stdin;
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
05d0a1c8-465a-4181-a1e8-1ad91dc09686	985a2e3231c25bec7572b1686dea8257fcd010b435f613367a60d645263b5653	2026-01-13 11:00:42.309264+01	20260113093214_init	\N	\N	2026-01-13 11:00:42.303208+01	1
\.


--
-- Name: Account Account_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: UserMedia UserMedia_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."UserMedia"
    ADD CONSTRAINT "UserMedia_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Account_provider_providerAccountId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON public."Account" USING btree (provider, "providerAccountId");


--
-- Name: Session_sessionToken_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Session_sessionToken_key" ON public."Session" USING btree ("sessionToken");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: VerificationToken_identifier_token_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON public."VerificationToken" USING btree (identifier, token);


--
-- Name: VerificationToken_token_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "VerificationToken_token_key" ON public."VerificationToken" USING btree (token);


--
-- Name: Account Account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserMedia UserMedia_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."UserMedia"
    ADD CONSTRAINT "UserMedia_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict dvPdEGemqmdPY2CbZcjzf3TObHjQubWBIy1Lky28iKbcjQJPjIs19c8Dq64rH4W

