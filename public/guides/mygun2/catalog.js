// Official guide checked 2026-11-05; rewards checked 2026-11-06; Eon additions checked against update 881 on 2026-11-19.
export const catalogue = [
  {
    "id": "eon",
    "name": "이온",
    "source": "https://guide.sa.nexon.com/guide/45#toc-0",
    "updateSource": "https://sa.nexon.com/news/update/view.aspx?n4ArticleSN=881",
    "checkedAt": "2026-11-19",
    "guns": [
      {
        "name": "[M]GAL-1_v2(IS) Eon / [M] GAL-1_v2 (IK) Eon",
        "base": "GAL-1_v2",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20260813072410.png",
        "image": "images/eon-01.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M] P90_v2(I) Eon / [M]P90_v2(IS) Eon",
        "base": "P90_v2",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20260813072428.png",
        "image": "images/eon-02.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]TAS(I) Eon / [M]TAS(IS) Eon",
        "base": "TAS",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20260917072233.png",
        "image": "images/eon-03.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]AWP(I) Eon / [M]AWP(IS) Eon",
        "base": "AWP",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20260917072223.png",
        "image": "images/eon-04.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]Specter(I) Eon / [M]Specter(IS) Eon",
        "base": "Specter",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20261022082039.png",
        "image": "images/eon-05.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]AK47(IK) Light Eon / [M] AK47(ISK) Light Eon",
        "base": "AK47",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20261022082047.png",
        "image": "images/eon-06.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]SCAR_v2(I) Eon / [M]SCAR_v2(IS) Eon",
        "base": "SCAR_v2",
        "sourceImage": "https://img-sa-file.nexon.com/DSK01/07/NX_FILE/Board/94227/01/1/000/00/00/5125118645353054217.gif",
        "image": "images/eon-07.webp",
        "width": 330,
        "height": 335
      },
      {
        "name": "[M]GSR-6(I) Eon / [M]GSR-6(IS) Eon",
        "base": "GSR-6",
        "sourceImage": "https://img-sa-file.nexon.com/DSK00/02/NX_File/Board/94227/01/1/000/00/00/4764830683753349131.gif",
        "image": "images/eon-08.webp",
        "width": 330,
        "height": 335
      }
    ],
    "sets": [
      {
        "count": "3",
        "reward": "[M]BombTechkit Ⅱ Eon (Lv.50)",
        "effect": "교체 시간 단축 · 설치/해체 성공 시 Eon 스택 최대 충전",
        "image": "images/rewards/eon-01.png",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20260917072529.png",
        "width": 310,
        "height": 150,
        "imageBounds": {
          "x": 114,
          "y": 25,
          "width": 82,
          "height": 100
        }
      },
      {
        "count": "6",
        "reward": "[M]G350 Eon (Lv.50)",
        "effect": "교체/사용 시간 단축 · 해당 무기로 적 처치 시 Eon 스택 최대 충전 · 특수기능6으로 모드 전환 시, G600 성능으로 변경",
        "image": "images/rewards/eon-02.png",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20261022082144.png",
        "width": 310,
        "height": 150,
        "imageBounds": {
          "x": 104,
          "y": 25,
          "width": 102,
          "height": 100
        }
      }
    ],
    "exceptions": [],
    "levels": [
      {
        "level": "1",
        "experience": "경험치 10% 추가",
        "benefit": "이펙트 추가"
      },
      {
        "level": "10",
        "experience": "경험치 20% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "20",
        "experience": "경험치 30% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "30",
        "experience": "경험치 50% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "40",
        "experience": "경험치 70% 추가",
        "benefit": "외형 / 이펙트 변경  /  교체/재장전 시간 단축  /  이온장전 기능 사용 가능"
      },
      {
        "level": "50",
        "experience": "경험치 100% 추가",
        "benefit": "Lv.40 혜택 유지  /  무기/손 반투명 적용"
      }
    ],
    "english": "Eon",
    "tagline": "피해량을 쌓아, 빠른 재장전",
    "category": "빠른 재장전",
    "minLevel": 40,
    "trigger": "이온 스택 3개 충족",
    "triggerDetail": "150 피해마다 1스택. 한 번의 타격은 최대 150까지 집계하고, 헤드샷은 즉시 3스택을 채웁니다.",
    "persistence": "3스택 이후 경기 종료까지 사용",
    "effect": "이온장전으로 재장전 모션과 시간이 바뀝니다.",
    "note": "피해량·스택은 같은 이온 시리즈끼리 공유합니다. 2026년 11월 19일 기준 9세트 효과는 추후 공개 예정입니다.",
    "color": "#25c8dd"
  },
  {
    "id": "evo",
    "name": "에보",
    "source": "https://guide.sa.nexon.com/guide/45#toc-4",
    "checkedAt": "2026-11-05",
    "guns": [
      {
        "name": "[M]GAL-1_v2(IS) EVO / [M]GAL-1_v2(IK) EVO",
        "base": "GAL-1_v2",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evo/[M]GAL-1_v2_ik_Evo.png",
        "image": "images/evo-01.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]AWP(I) EVO / [M]AWP(IS) EVO",
        "base": "AWP",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evo/[M]AWP_is_Evo.png",
        "image": "images/evo-02.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]AK47(IK) Light EVO / [M]AK47(ISK) Light EVO",
        "base": "AK47",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evo/[M]AK47_isk_light_Evo.png",
        "image": "images/evo-03.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]TAC-9 EVO / [M]TAC-9(S) EVO",
        "base": "TAC-9",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evo/[M]TAC-9_s_Evo.png",
        "image": "images/evo-04.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]Specter(I) EVO / [M]Specter(IS) EVO",
        "base": "Specter",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evo/[M]Specter_is_Evo.png",
        "image": "images/evo-05.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]VS-9 EVO / [M]VS-9(S) EVO",
        "base": "VS-9",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evo/[M]VS-9_s_Evo.png",
        "image": "images/evo-06.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]MSR-200(I) EVO / [M]MSR-200(IS) EVO",
        "base": "MSR-200",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evo/[M]MSR-200_is_Evo.png",
        "image": "images/evo-07.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]XM68(I) EVO / [M]XM68(IS) EVO",
        "base": "XM68",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evo/[M]XM68_is_Evo.png",
        "image": "images/evo-08.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]DRT-6(I) EVO / [M]DRT-6(IK) EVO",
        "base": "DRT-6",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20260806084924.png",
        "image": "images/evo-09.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]DSG-12(I) EVO / [M]DSG-12(IS) EVO",
        "base": "DSG-12",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20260806084945.png",
        "image": "images/evo-10.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]SCAR_v2(I) EVO / [M]SCAR_v2(IS) EVO",
        "base": "SCAR_v2",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20260806084959.png",
        "image": "images/evo-11.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]HK416_v2(I) EVO / [M]HK416_v2(IS) EVO",
        "base": "HK416_v2",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20260806085008.png",
        "image": "images/evo-12.webp",
        "width": 311,
        "height": 150
      }
    ],
    "sets": [
      {
        "count": "3",
        "reward": "[M]Blade EVO (Lv.50)",
        "effect": "특수기능6으로 특수모션 사용 가능",
        "image": "images/rewards/evo-01.png",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20260806085104.png",
        "width": 170,
        "height": 21,
        "imageBounds": {
          "x": 0,
          "y": 0,
          "width": 170,
          "height": 21
        }
      },
      {
        "count": "6",
        "reward": "[M]G600 EVO (Lv.50)",
        "effect": "교체/사용 시간 단축 · 특수기능6으로 모드 전환 시, G350 성능으로 변경",
        "image": "images/rewards/evo-02.png",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20260806085111.png",
        "width": 80,
        "height": 80,
        "imageBounds": {
          "x": 0,
          "y": 0,
          "width": 80,
          "height": 80
        }
      },
      {
        "count": "9",
        "reward": "[M]BombTechkit II EVO (Lv.50)",
        "effect": "교체 시간 단축 · 설치/해체 성공 시 EVO 스택 증가",
        "image": "images/rewards/evo-03.png",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20260806085120.png",
        "width": 116,
        "height": 59,
        "imageBounds": {
          "x": 0,
          "y": 0,
          "width": 116,
          "height": 59
        }
      },
      {
        "count": "12",
        "reward": "[M]SG870_v2(I) EVO (Lv.50)",
        "effect": "교체/재장전 시간 단축 · 장전탄약 +1 · 에볼루션 기능 사용 가능",
        "image": "images/rewards/evo-04.png",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20260806085127.png",
        "width": 227,
        "height": 41,
        "imageBounds": {
          "x": 0,
          "y": 0,
          "width": 227,
          "height": 41
        }
      }
    ],
    "exceptions": [],
    "levels": [
      {
        "level": "1",
        "experience": "경험치 10% 추가",
        "benefit": "이펙트 추가"
      },
      {
        "level": "10",
        "experience": "경험치 20% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "20",
        "experience": "경험치 30% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "30",
        "experience": "경험치 50% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "40",
        "experience": "경험치 70% 추가",
        "benefit": "외형 / 이펙트 변경  /  교체/재장전 시간 단축  /  에볼루션 기능 사용 가능"
      },
      {
        "level": "50",
        "experience": "경험치 100% 추가",
        "benefit": "Lv.40 혜택 유지  /  무기/손 반투명 적용"
      }
    ],
    "english": "EVO",
    "tagline": "처치 후 진화하는 두 단계",
    "category": "성장·진화",
    "minLevel": 40,
    "trigger": "3킬 스택을 채운 뒤 재장전",
    "triggerDetail": "최대 두 단계까지 진화합니다. 조건 충족 상태에서 리스폰하면 자동으로 진화합니다.",
    "persistence": "진화·스택은 라운드와 리스폰 이후에도 유지",
    "effect": "1단계는 빠른 재장전, 2단계는 총기별 장탄수 증가입니다.",
    "note": "AWP·MSR-200·SG870_v2는 +1, 공식 표의 나머지 대상 총기는 +2입니다. 초과 스택과 진화 상태는 에보끼리 공유합니다.",
    "color": "#b8da72"
  },
  {
    "id": "circle",
    "name": "서클",
    "source": "https://guide.sa.nexon.com/guide/45#toc-8",
    "checkedAt": "2026-11-05",
    "guns": [
      {
        "name": "[M]ANR(I) Circle / [M]ANR(IS) Circle",
        "base": "ANR",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/circle/[M]ANR_is_Circle.png",
        "image": "images/circle-01.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]P90_v2(IS) Circle / [M]P90_v2(IK) Circle",
        "base": "P90_v2",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/circle/[M]P90_v2_ik_Circle.png",
        "image": "images/circle-02.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]MP-X3(I) Circle / [M]MP-X3(IS) Circle",
        "base": "MP-X3",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/circle/[M]MP-X3_is_Circle.png",
        "image": "images/circle-03.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]AK47(I) Circle / [M]AK47(IK) Circle",
        "base": "AK47",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/circle/[M]AK47_ik_Circle.png",
        "image": "images/circle-04.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]AWP(I) Circle / [M]AWP(IS) Circle",
        "base": "AWP",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/circle/[M]AWP_is_Circle.png",
        "image": "images/circle-05.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]MP7(IS) Circle / [M]MP7(IK) Circle",
        "base": "MP7",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/circle/[M]MP7_ik_Circle.png",
        "image": "images/circle-06.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]TSR(I) Circle / [M]TSR(IS) Circle",
        "base": "TSR",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/circle/[M]TSR_is_Circle.png",
        "image": "images/circle-07.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]DRT-6(I) Circle / [M]DRT-6(IK) Circle",
        "base": "DRT-6",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/circle/[M]DRT_ik_Circle.png",
        "image": "images/circle-08.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]MSR-200(I) Circle / [M]MSR-200(IS) Circle",
        "base": "MSR-200",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/circle/[M]MSR_is_Circle.png",
        "image": "images/circle-09.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]VS-9 Circle / [M]VS-9(S) Circle",
        "base": "VS-9",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/circle/[M]VS-9_s_Circle.png",
        "image": "images/circle-10.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]XM68(I) Circle / [M]XM68(IS) Circle",
        "base": "XM68",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/circle/[M]XM68_is_Circle.png",
        "image": "images/circle-11.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]SCAR_v2(I) Circle / [M]SCAR_v2(IS) Circle",
        "base": "SCAR_v2",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/circle/[M]SCAR_v2_is_Circle.png",
        "image": "images/circle-12.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]ANR(I) Circle Black / [M]ANR(IS) Circle Black",
        "base": "ANR",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/circle/[M]ANR_black_is_Circle.png",
        "image": "images/circle-13.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]P90_v2(IS) Circle Black / [M]P90_v2(IK) Circle Black",
        "base": "P90_v2",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/circle/[M]P90_black_ik_Circle.png",
        "image": "images/circle-14.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]MP-X3(I) Circle Black / [M]MP-X3(IS) Circle Black",
        "base": "MP-X3",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/circle/[M]MP-X3_black_is_Circle.png",
        "image": "images/circle-15.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]AK47(I) Circle Black / [M]AK47(IK) Circle Black",
        "base": "AK47",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/circle/[M]AK47_black_ik_Circle.png",
        "image": "images/circle-16.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]XM68(I) Circle Black / [M]XM68(IS) Circle Black",
        "base": "XM68",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20260806085201.png",
        "image": "images/circle-17.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]SCAR_v2(I) Circle Black / [M]SCAR_v2(IS) Circle Black",
        "base": "SCAR_v2",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20260806085214.png",
        "image": "images/circle-18.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]MSR-200(I) Circle Black / [M]MSR-200(IS) Circle Black",
        "base": "MSR-200",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20261105085707.png",
        "image": "images/circle-19.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]VS-9 Circle Black / VS-9(S) Circle Black",
        "base": "VS-9",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20261105085719.png",
        "image": "images/circle-20.webp",
        "width": 310,
        "height": 150
      }
    ],
    "sets": [
      {
        "count": "3",
        "reward": "[M]G600 Circle (Lv.50)",
        "effect": "교체/사용 시간 단축 · 특수기능6으로 모드 전환 시, G350 성능으로 변경",
        "image": "images/rewards/circle-01.png",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20260806085255.png",
        "width": 80,
        "height": 74,
        "imageBounds": {
          "x": 0,
          "y": 0,
          "width": 80,
          "height": 74
        }
      },
      {
        "count": "6",
        "reward": "[M]Blade Circle (Lv.50)",
        "effect": "좌 클릭 시 전기충격, 우 클릭 시 Blade Circle 공격 · 교체/좌클릭 공격 시간 단축 · 특수기능6으로 특수모션 사용 가능",
        "image": "images/rewards/circle-02.png",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20260806085028.png",
        "width": 189,
        "height": 22,
        "imageBounds": {
          "x": 0,
          "y": 0,
          "width": 189,
          "height": 22
        }
      },
      {
        "count": "9",
        "reward": "[M]S.T. Circle (Lv.50)",
        "effect": "교체 시간 단축 · BombTechKit II, 스카우터5 기능 사용가능 · 스카우터5는 스카우터4 기능을 포함하며 추가로 아군이 설치한 C4설치 구역 확인 가능",
        "image": "images/rewards/circle-03.png",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20260806085302.png",
        "width": 80,
        "height": 80,
        "imageBounds": {
          "x": 0,
          "y": 0,
          "width": 80,
          "height": 80
        }
      },
      {
        "count": "12",
        "reward": "[M]AWX(IS) Circle (Lv.50)",
        "effect": "ㆍ 무기/손 반투명 적용 ㆍ 교체/재장전 시간 단축 ㆍ 장전탄약 +1 ㆍ 서클장전 사용 가능 ㆍ 경험치 50% 추가",
        "image": "images/rewards/circle-04.png",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20260806085309.png",
        "width": 272,
        "height": 43,
        "imageBounds": {
          "x": 0,
          "y": 0,
          "width": 272,
          "height": 43
        }
      }
    ],
    "exceptions": [],
    "levels": [
      {
        "level": "1",
        "experience": "경험치 10% 추가",
        "benefit": "이펙트 추가"
      },
      {
        "level": "10",
        "experience": "경험치 20% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "20",
        "experience": "경험치 30% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "30",
        "experience": "경험치 50% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "40",
        "experience": "경험치 70% 추가",
        "benefit": "외형 / 이펙트 변경  /  교체/재장전 시간 단축  /  서클장전 사용 가능"
      },
      {
        "level": "50",
        "experience": "경험치 100% 추가",
        "benefit": "Lv.40 혜택 유지  /  무기/손 반투명 적용"
      }
    ],
    "english": "Circle",
    "tagline": "남은 탄이 적을 때 빠르게",
    "category": "빠른 재장전",
    "minLevel": 40,
    "trigger": "총기별 잔탄 기준 이하",
    "triggerDetail": "P90_v2 25발, ANR·MP-X3·AK47·MP7·DRT-6·SCAR_v2 15발, XM68 10발, VS-9 6발, AWX 4발, AWP·TSR·MSR-200 3발 이하입니다.",
    "persistence": "재장전 후 다시 잔탄 조건을 충족하면 사용",
    "effect": "서클장전으로 별도의 빠른 재장전을 사용합니다.",
    "note": "잔탄 기준은 모든 총기가 같지 않습니다. Black 외형 목록도 같은 시리즈 안에서 구분합니다.",
    "color": "#c79aff"
  },
  {
    "id": "hunt",
    "name": "헌트",
    "source": "https://guide.sa.nexon.com/guide/45#toc-12",
    "checkedAt": "2026-11-05",
    "guns": [
      {
        "name": "[M]FAMAS(IK) Hunt / [M]FAMAS(IS) Hunt",
        "base": "FAMAS",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/hunt/[M]FAMAS(IS)_Hunt.png",
        "image": "images/hunt-01.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]DRT-6(I) Hunt / [M]DRT-6(IS) Hunt",
        "base": "DRT-6",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/hunt/[M]DRT-6(IS)_Hunt.png",
        "image": "images/hunt-02.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]SIG556(I) Hunt / [M]SIG556(IK) Hunt",
        "base": "SIG556",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/hunt/[M]SIG556(IK)_Hunt.png",
        "image": "images/hunt-03.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]UAR_v2(I) Hunt / [M]UAR_v2(IS) Hunt",
        "base": "UAR_v2",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/hunt/[M]UAR_v2(IS)_Hunt.png",
        "image": "images/hunt-04.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]MP7(IK) Hunt / [M]MP7(IS) Hunt",
        "base": "MP7",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/hunt/[M]MP7(IS)_Hunt.png",
        "image": "images/hunt-05.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]VS-9 Hunt / [M]VS-9(S) Hunt",
        "base": "VS-9",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/hunt/[M]VS-9(S)_Hunt.png",
        "image": "images/hunt-06.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]MP-X3(I) Hunt / [M]MP-X3(IS) Hunt",
        "base": "MP-X3",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/hunt/[M]MP-X3(IS)_Hunt.png",
        "image": "images/hunt-07.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]윈체스터(I) Hunt / [M]윈체스터(IS) Hunt",
        "base": "윈체스터",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/hunt/[M]Winchester(IS)_Hunt.png",
        "image": "images/hunt-08.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]AWP(I) Hunt / [M]AWP(IS) Hunt",
        "base": "AWP",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/hunt/[M]AWP(IS)_Hunt.png",
        "image": "images/hunt-09.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]PPS Hunt / [M]PPS(S) Hunt",
        "base": "PPS",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/hunt/[M]PPS(S)_Hunt.png",
        "image": "images/hunt-10.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]SCAR_v2(I) Hunt / [M]SCAR_v2(IS) Hunt",
        "base": "SCAR_v2",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/hunt/[M]SCAR_v2(IS)_Hunt.png",
        "image": "images/hunt-11.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]MSR-200(I) Hunt / [M]MSR-200(IS) Hunt",
        "base": "MSR-200",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/hunt/[M]MSR-200(IS)_Hunt.png",
        "image": "images/hunt-12.webp",
        "width": 311,
        "height": 150
      }
    ],
    "sets": [
      {
        "count": "3",
        "reward": "[M]G600 Hunt (Lv.50)",
        "effect": "교체/사용 시간 단축 · 특수기능6으로 모드 전환 시, Throw Axe 성능으로 변경",
        "image": "images/rewards/hunt-01.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/hunt/[M]G600_Hunt_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 90,
          "y": 47,
          "width": 130,
          "height": 26
        }
      },
      {
        "count": "6",
        "reward": "[M]Combo Knife Hunt (Lv.50)",
        "effect": "교체/우클릭 공격 시간 단축 · 대미지/사거리 증가 · 콤보기능 사용 가능 · 특수기능6으로 특수모션 사용 가능",
        "image": "images/rewards/hunt-02.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/hunt/[M]Combo_Knife%20Hunt_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 85,
          "y": 47,
          "width": 140,
          "height": 26
        }
      },
      {
        "count": "9",
        "reward": "[M]Swordkit Hunt (Lv.50)",
        "effect": "교체 시간 단축",
        "image": "images/rewards/hunt-03.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/hunt/[M]BombTechkit%E2%85%A1_Hunt_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 75,
          "y": 46,
          "width": 160,
          "height": 28
        }
      },
      {
        "count": "12",
        "reward": "[M]AK47(IK) Clutch Hunt (Lv.50)",
        "effect": "교체/재장전 시간 단축 · Hunt 전용 특수무기 사용 가능 · Clutch 기능 적용",
        "image": "images/rewards/hunt-04.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/hunt/[M]AK47(IK)_Clutch_Hunt_(Lv.50).png",
        "width": 250,
        "height": 60,
        "imageBounds": {
          "x": 0,
          "y": 0,
          "width": 250,
          "height": 60
        }
      }
    ],
    "exceptions": [],
    "levels": [
      {
        "level": "1",
        "experience": "경험치 10% 추가",
        "benefit": "이펙트 추가"
      },
      {
        "level": "10",
        "experience": "경험치 20% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "20",
        "experience": "경험치 30% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "30",
        "experience": "경험치 50% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "40",
        "experience": "경험치 70% 추가",
        "benefit": "외형 / 이펙트 변경  /  교체/재장전 시간 단축 - 윈체스터는 재장전 시간만 단축  /  Hunt 전용 특수무기 사용 가능"
      },
      {
        "level": "50",
        "experience": "경험치 100% 추가",
        "benefit": "Lv.40 혜택 유지  /  무기/손 반투명 적용"
      }
    ],
    "english": "Hunt",
    "tagline": "투척 나이프를 꺼내는 순간",
    "category": "특수 공격",
    "minLevel": 40,
    "trigger": "특수기능 6 입력",
    "triggerDetail": "기본 단축키는 마우스 휠 클릭입니다.",
    "persistence": "리스폰당 1회",
    "effect": "전용 투척 나이프를 사용합니다.",
    "note": "공룡 모드·투척무기 금지 모드·훈련소에서는 사용할 수 없습니다. 주무기와 보조무기의 특수 공격은 같다고 가정하지 않습니다.",
    "color": "#edaa6c"
  },
  {
    "id": "xeno",
    "name": "제노",
    "source": "https://guide.sa.nexon.com/guide/45#toc-16",
    "checkedAt": "2026-11-05",
    "guns": [
      {
        "name": "[M]AK47(I) Xeno / [M]AK47(IK) Xeno",
        "base": "AK47",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/xeno/[M]AK47(IK)_Xeno.png",
        "image": "images/xeno-01.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]NA-34(I) Xeno / [M]NA-34(IS) Xeno",
        "base": "NA-34",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/xeno/[M]NA-34(IS)_Xeno.png",
        "image": "images/xeno-02.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]DRT-6(I) Xeno / [M]DRT-6(IS) Xeno",
        "base": "DRT-6",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/xeno/[M]DRT-6(IS)_Xeno.png",
        "image": "images/xeno-03.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]ANR(I) Xeno / [M]ANR(IS) Xeno",
        "base": "ANR",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/xeno/[M]ANR(IS)_Xeno.png",
        "image": "images/xeno-04.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]윈체스터(I) Xeno / [M]윈체스터(IS) Xeno",
        "base": "윈체스터",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/xeno/[M]Winchester(IS)_Xeno.png",
        "image": "images/xeno-05.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]AWP(I) Xeno / [M]AWP(IS) Xeno",
        "base": "AWP",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/xeno/[M]AWP(IS)_Xeno.png",
        "image": "images/xeno-06.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]MP7(IS) Xeno / [M]MP7(IK) Xeno",
        "base": "MP7",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/xeno/[M]MP7(IK)_Xeno.png",
        "image": "images/xeno-07.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]SG-12(I) Xeno / [M]SG-12(IS) Xeno",
        "base": "SG-12",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/xeno/[M]SG-12(IS)_Xeno.png",
        "image": "images/xeno-08.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]KRISS(I) Xeno / [M]KRISS(IS) Xeno",
        "base": "KRISS",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/xeno/[M]KRISS(IS)_Xeno.png",
        "image": "images/xeno-09.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]P90_v2(IS) Xeno / [M]P90_v2(IK) Xeno",
        "base": "P90_v2",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/xeno/[M]P90_v2(IK)_Xeno.png",
        "image": "images/xeno-10.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]G18 Xeno / [M]G18(S) Xeno",
        "base": "G18",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/xeno/[M]G18(S)_Xeno.png",
        "image": "images/xeno-11.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]PPS Xeno / [M]PPS(S) Xeno",
        "base": "PPS",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/xeno/[M]PPS(S)_Xeno.png",
        "image": "images/xeno-12.webp",
        "width": 310,
        "height": 150
      }
    ],
    "sets": [
      {
        "count": "3",
        "reward": "[M]BombTechkitⅡ Xeno (Lv.50)",
        "effect": "교체 시간 단축",
        "image": "images/rewards/xeno-01.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/xeno/[M]BombTechkit%E2%85%A1_Xeno_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 125,
          "y": 25,
          "width": 60,
          "height": 70
        }
      },
      {
        "count": "6",
        "reward": "[M]G350 Xeno (Lv.50)",
        "effect": "교체/사용 시간 단축 · 특수기능6으로 모드 전환 시, Dynamite 성능으로 변경",
        "image": "images/rewards/xeno-02.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/xeno/[M]G350_Xeno_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 125,
          "y": 28,
          "width": 60,
          "height": 64
        }
      },
      {
        "count": "9",
        "reward": "[M]Knife Xeno (Lv.50)",
        "effect": "교체/우클릭 공격 시간 단축 · 대미지/사거리 증가 · 특수기능6으로 모드 전환 시, 손톱 성능으로 변경",
        "image": "images/rewards/xeno-03.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/xeno/[M]Knife_Xeno_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 85,
          "y": 50,
          "width": 140,
          "height": 20
        }
      },
      {
        "count": "12",
        "reward": "[M]XM68(IS) Xeno (Lv.50)",
        "effect": "제압장전 사용 가능 · 장전탄약 +1 · 특수기능6으로 모드 전환 시, 소음기 탈부착 가능",
        "image": "images/rewards/xeno-04.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/xeno/[M]XM68(IS)_Xeno_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 50,
          "y": 40,
          "width": 210,
          "height": 40
        }
      }
    ],
    "exceptions": [
      "윈체스터는 재장전 시간만 단축"
    ],
    "levels": [
      {
        "level": "1",
        "experience": "경험치 10% 추가",
        "benefit": "이펙트 추가"
      },
      {
        "level": "10",
        "experience": "경험치 20% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "20",
        "experience": "경험치 30% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "30",
        "experience": "경험치 50% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "40",
        "experience": "경험치 70% 추가",
        "benefit": "외형 / 이펙트 변경  /  교체/재장전 시간 단축 - 윈체스터는 재장전 시간만 단축 - G18은 장탄수 +3으로 대체  /  제압장전 사용 가능"
      },
      {
        "level": "50",
        "experience": "경험치 100% 추가",
        "benefit": "Lv.40 혜택 유지  /  무기/손 반투명 적용"
      }
    ],
    "english": "Xeno",
    "tagline": "처치가 다음 장전을 열어줍니다",
    "category": "빠른 재장전",
    "minLevel": 40,
    "trigger": "제노 무기로 적 처치",
    "triggerDetail": "처치 후 제압장전 한 번을 사용할 수 있습니다.",
    "persistence": "다시 처치하면 재사용. 라운드 전환·무기 버리기 시 해제",
    "effect": "별도의 빠른 재장전을 제공합니다.",
    "note": "훈련소에서는 제압장전을 사용할 수 없습니다.",
    "color": "#ff8fa0"
  },
  {
    "id": "nova",
    "name": "노바",
    "source": "https://guide.sa.nexon.com/guide/45#toc-20",
    "checkedAt": "2026-11-05",
    "guns": [
      {
        "name": "[M]AK47(IK) Light Nova / [M]AK47(IK) Heavy Nova",
        "base": "AK47",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/nova/[M]AK47_Heavy(IK)_Nova.png",
        "image": "images/nova-01.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]NA-34(I) Nova / [M]NA-34(IS) Nova",
        "base": "NA-34",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/nova/[M]NA-34(IS)_Nova.png",
        "image": "images/nova-02.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]DRT-6(I) Nova / [M]DRT-6(IS) Nova",
        "base": "DRT-6",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/nova/[M]DRT-6(IS)_Nova.png",
        "image": "images/nova-03.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]AK103(I) Nova / [M]AK103(IK) Nova",
        "base": "AK103",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/nova/[M]AK103(IS)_Nova.png",
        "image": "images/nova-04.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]ANR(I) Nova / [M]ANR(IS) Nova",
        "base": "ANR",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/nova/[M]ANR(IS)_Nova.png",
        "image": "images/nova-05.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]SIG556(I) Nova / [M]SIG556(IK) Nova",
        "base": "SIG556",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/nova/[M]SIG556(IS)_Nova.png",
        "image": "images/nova-06.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]TRG21(I) Nova / [M]TRG21(IS) Nova",
        "base": "TRG21",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/nova/[M]TRG21(IS)_Nova.png",
        "image": "images/nova-07.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]윈체스터(I) Nova / [M]윈체스터(IS) Nova",
        "base": "윈체스터",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/nova/[M]Winchester(IS)_Nova.png",
        "image": "images/nova-08.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]AWP(I) Nova / [M]AWP(IS) Nova",
        "base": "AWP",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/nova/[M]AWP(IS)_Nova.png",
        "image": "images/nova-09.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]P90_v2(I) Nova / [M]P90_v2(IS) Nova",
        "base": "P90_v2",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/nova/[M]P90_v2(IS)_Nova.png",
        "image": "images/nova-10.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]VS-9 Nova / [M]VS-9(S) Nova",
        "base": "VS-9",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/nova/[M]VS-9(S)_Nova.png",
        "image": "images/nova-11.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]G18 Nova / [M]G18(S) Nova",
        "base": "G18",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/nova/[M]G18(S)_Nova.png",
        "image": "images/nova-12.webp",
        "width": 310,
        "height": 150
      }
    ],
    "sets": [
      {
        "count": "3",
        "reward": "[M]Blade Nova (Lv.50)",
        "effect": "좌 클릭 시 전기충격, 우 클릭 시 Blade Nova 공격 · 교체/좌클릭 공격 시간 단축 · 특수기능6으로 특수모션 사용 가능",
        "image": "images/rewards/nova-01.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/nova/[M]Blade_Nova_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 35,
          "y": 51,
          "width": 240,
          "height": 18
        }
      },
      {
        "count": "6",
        "reward": "[M]G600 Nova (Lv.50)",
        "effect": "교체/사용 시간 단축 · 특수기능6으로 모드 전환 시, 연막탄 성능으로 변경 (연막탄은 우 클릭 시 굴려서 투척 가능)",
        "image": "images/rewards/nova-02.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/nova/[M]G600_Nova_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 125,
          "y": 30,
          "width": 60,
          "height": 60
        }
      },
      {
        "count": "9",
        "reward": "[M]PPS(S) Nova (Lv.50)",
        "effect": "교체/재장전 시간 단축 · 장전탄약 +1 · Nova 전용 특수무기 사용 가능",
        "image": "images/rewards/nova-03.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/nova/[M]PPS(S)_Nova_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 95,
          "y": 37,
          "width": 120,
          "height": 46
        }
      },
      {
        "count": "12",
        "reward": "[M]TSR(IS) Nova (Lv.50)",
        "effect": "교체/재장전 시간 단축 · 장전탄약 +1 · Nova 전용 특수무기 사용 가능",
        "image": "images/rewards/nova-04.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/nova/[M]TSR(IS)_Nova_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 40,
          "y": 37,
          "width": 230,
          "height": 46
        }
      }
    ],
    "exceptions": [
      "윈체스터는 재장전 시간만 단축"
    ],
    "levels": [
      {
        "level": "1",
        "experience": "경험치 10% 추가",
        "benefit": "이펙트 추가"
      },
      {
        "level": "10",
        "experience": "경험치 20% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "20",
        "experience": "경험치 30% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "30",
        "experience": "경험치 50% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "40",
        "experience": "경험치 70% 추가",
        "benefit": "외형 / 이펙트 변경  /  교체/재장전 시간 단축 - 윈체스터는 재장전 시간만 단축 - G18은 장탄수 +3으로 대체  /  Nova 전용 특수무기 사용 가능"
      },
      {
        "level": "50",
        "experience": "경험치 100% 추가",
        "benefit": "Lv.40 혜택 유지  /  무기/손 반투명 적용"
      }
    ],
    "english": "Nova",
    "tagline": "전용 근접무기로 이어지는 공격",
    "category": "특수 공격",
    "minLevel": 40,
    "trigger": "특수기능 6 입력",
    "triggerDetail": "기본 단축키는 마우스 휠 클릭입니다.",
    "persistence": "공식 기능 안내에 별도 횟수 제한 미기재",
    "effect": "전용 특수 근접무기를 사용합니다.",
    "note": "횟수·세부 성능이 다른 시리즈와 같다고 추정하지 않습니다.",
    "color": "#96adff"
  },
  {
    "id": "royal",
    "name": "로얄",
    "source": "https://guide.sa.nexon.com/guide/45#toc-24",
    "checkedAt": "2026-11-05",
    "guns": [
      {
        "name": "[M]UAR_v2(I) Royal / [M]UAR_v2(IS) Royal",
        "base": "UAR_v2",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/royal/[M]UAR_v2(IS)_Royal.png",
        "image": "images/royal-01.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]M4A1(I) Royal / [M]M4A1(IS) Royal",
        "base": "M4A1",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/royal/[M]M4A1(IS)_Royal.png",
        "image": "images/royal-02.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]NA-34(I) Royal / [M]NA-34(IS) Royal",
        "base": "NA-34",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/royal/[M]NA-34(IS)_Royal.png",
        "image": "images/royal-03.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]DRT-6(I) Royal / [M]DRT-6(IS) Royal",
        "base": "DRT-6",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/royal/[M]DRT-6(IS)_Royal.png",
        "image": "images/royal-04.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]SIG556(I) Royal / [M]SIG556(IK) Royal",
        "base": "SIG556",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/royal/[M]SIG556(IK)_Royal.png",
        "image": "images/royal-05.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]FAMAS(I) Royal / [M]FAMAS(IK) Royal",
        "base": "FAMAS",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/royal/[M]FAMAS(IK)_Royal.png",
        "image": "images/royal-06.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]ANR(I) Royal / [M]ANR(IS) Royal",
        "base": "ANR",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/royal/[M]ANR(IS)_Royal.png",
        "image": "images/royal-07.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]윈체스터(I) Royal / [M]윈체스터(IS) Royal",
        "base": "윈체스터",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/royal/[M]Winchester(IS)_Royal.png",
        "image": "images/royal-08.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]AWP(I) Royal / [M]AWP(IS) Royal",
        "base": "AWP",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/royal/[M]AWP(IS)_Royal.png",
        "image": "images/royal-09.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]SG870_v2(I) Royal / [M]SG870_v2(IS) Royal",
        "base": "SG870_v2",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/royal/[M]SG870_v2(IS)_Royal.png",
        "image": "images/royal-10.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]MP7(I) Royal / [M]MP7(IS) Royal",
        "base": "MP7",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/royal/[M]MP7(IS)_Royal.png",
        "image": "images/royal-11.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]Peacemaker Royal / [M]Peacemaker(S) Royal",
        "base": "Peacemaker",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/royal/[M]Peacemaker(S)_Royal.png",
        "image": "images/royal-12.webp",
        "width": 310,
        "height": 150
      }
    ],
    "sets": [
      {
        "count": "3",
        "reward": "[M]GD400 Royal (Lv.50)",
        "effect": "교체/사용 시간 단축 · 좌 클릭 시 G400, 우 클릭 시 Dynamite 성능",
        "image": "images/rewards/royal-01.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/royal/[M]GD400_Royal_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 135,
          "y": 27,
          "width": 40,
          "height": 66
        }
      },
      {
        "count": "6",
        "reward": "[M]Swordkit Royal (Lv.50)",
        "effect": "교체 시간 단축 · 로얄 전용 핑 효과 적용",
        "image": "images/rewards/royal-02.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/royal/[M]Swordkit_Royal_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 50,
          "y": 46,
          "width": 210,
          "height": 28
        }
      },
      {
        "count": "9",
        "reward": "[M]Combo Dagger Royal (Lv.50)",
        "effect": "콤보기능 사용 가능 · 특수기능6으로 특수모션 사용 가능",
        "image": "images/rewards/royal-03.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/royal/[M]Combo_Dagger_Royal_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 100,
          "y": 50,
          "width": 110,
          "height": 19
        }
      },
      {
        "count": "12",
        "reward": "[M]GSR-6(IS) Royal (Lv.50)",
        "effect": "교체/재장전 시간 단축 · 장전탄약 +1 · Royal 전용 특수무기 사용 가능",
        "image": "images/rewards/royal-04.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/royal/[M]GSR-6(IS)_Royal_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 35,
          "y": 32,
          "width": 240,
          "height": 56
        }
      }
    ],
    "exceptions": [],
    "levels": [
      {
        "level": "1",
        "experience": "경험치 10% 추가",
        "benefit": "이펙트 추가"
      },
      {
        "level": "10",
        "experience": "경험치 20% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "20",
        "experience": "경험치 30% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "30",
        "experience": "경험치 50% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "40",
        "experience": "경험치 70% 추가",
        "benefit": "외형 / 이펙트 변경  /  교체/재장전 시간 단축 - 윈체스터는 재장전 시간만 단축  /  Royal 전용 특수무기 사용 가능"
      },
      {
        "level": "50",
        "experience": "경험치 100% 추가",
        "benefit": "Lv.40 혜택 유지  /  무기/손 반투명 적용"
      }
    ],
    "english": "Royal",
    "tagline": "전용 권총으로 추가 공격",
    "category": "특수 공격",
    "minLevel": 40,
    "trigger": "특수기능 6 입력",
    "triggerDetail": "기본 단축키는 마우스 휠 클릭입니다.",
    "persistence": "리스폰당 1회",
    "effect": "전용 권총을 난사하는 특수 공격입니다.",
    "note": "주무기 자체 성능과 특수 권총의 기능을 구분해서 보세요.",
    "color": "#e8c96e"
  },
  {
    "id": "rumble",
    "name": "럼블",
    "source": "https://guide.sa.nexon.com/guide/45#toc-28",
    "checkedAt": "2026-11-05",
    "guns": [
      {
        "name": "[M]NA-34(I) Rumble / [M]NA-34(IS) Rumble",
        "base": "NA-34",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/rumble/[M]NA-34(IS)_Rumble.png",
        "image": "images/rumble-01.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]AK47(I) Rumble / [M]AK47(IK) Rumble",
        "base": "AK47",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/rumble/[M]AK47(IK)_Rumble.png",
        "image": "images/rumble-02.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]SIG556(I) Rumble / [M]SIG556(IS) Rumble",
        "base": "SIG556",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/rumble/[M]SIG556(IS)_Rumble.png",
        "image": "images/rumble-03.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]NA-94(I) Rumble / [M]NA-94(IS) Rumble",
        "base": "NA-94",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/rumble/[M]NA-94(IS)_Rumble.png",
        "image": "images/rumble-04.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]FAMAS(I) Rumble / [M]FAMAS(IS) Rumble",
        "base": "FAMAS",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/rumble/[M]FAMAS(IS)_Rumble.png",
        "image": "images/rumble-05.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]AK103(I) Rumble / [M]AK103(IK) Rumble",
        "base": "AK103",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/rumble/[M]AK103(IK)_Rumble.png",
        "image": "images/rumble-06.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]AWP(I) Rumble / [M]AWP(IS) Rumble",
        "base": "AWP",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/rumble/[M]AWP(IS)_Rumble.png",
        "image": "images/rumble-07.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]윈체스터(I) Rumble / [M]윈체스터(IS) Rumble",
        "base": "윈체스터",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/rumble/[M]Winchester(IS)_Rumble.png",
        "image": "images/rumble-08.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]GSR-6(I) Rumble / [M]GSR-6(IS) Rumble",
        "base": "GSR-6",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/rumble/[M]GSR-6(IS)_Rumble.png",
        "image": "images/rumble-09.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]Mak-12(I) Rumble / [M]Mak-12(IS) Rumble",
        "base": "Mak-12",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/rumble/[M]Mak-12(IS)_Rumble.png",
        "image": "images/rumble-10.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]KRISS(I) Rumble / [M]KRISS(IS) Rumble",
        "base": "KRISS",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/rumble/[M]KRISS(IS)_Rumble.png",
        "image": "images/rumble-11.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]Peacemaker Rumble / [M]Peacemaker(S) Rumble",
        "base": "Peacemaker",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/rumble/[M]Peacemaker(S)_Rumble.png",
        "image": "images/rumble-12.webp",
        "width": 310,
        "height": 150
      }
    ],
    "sets": [
      {
        "count": "3",
        "reward": "[M]G600 Rumble (Lv.50)",
        "effect": "교체/사용 시간 단축 · 특수기능6으로 모드 전환 시, G350 성능으로 변경 · 교체 사운드 감소",
        "image": "images/rewards/rumble-01.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/rumble/[M]G600_Rumble_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 124,
          "y": 29,
          "width": 62,
          "height": 62
        }
      },
      {
        "count": "6",
        "reward": "[M]BombTechkitⅡ Rumble (Lv.50)",
        "effect": "교체 시간 단축 · 교체 사운드 감소 · 해체 사운드 범위 확장",
        "image": "images/rewards/rumble-02.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/rumble/[M]BombTechkit%E2%85%A1_Rumble_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 118,
          "y": 33,
          "width": 74,
          "height": 54
        }
      },
      {
        "count": "9",
        "reward": "[M]Sword Rumble (Lv.50)",
        "effect": "교체 시간 단축 · 교체 사운드 감소 · 특수기능6으로 모드 전환 시, 전기충격기 성능으로 변경",
        "image": "images/rewards/rumble-03.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/rumble/[M]Sword_Rumble_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 70,
          "y": 38,
          "width": 170,
          "height": 44
        }
      },
      {
        "count": "12",
        "reward": "[M]RA-PDW(IS) EX Rumble (Lv.50)",
        "effect": "럼블모드 사용 가능 (럼블모드 시 교체/재장전 시간 단축 및 추가 이펙트 적용) · 교체/재장전 사운드 감소",
        "image": "images/rewards/rumble-04.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/rumble/[M]RA-PDW(IS)_EX_Rumble_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 52,
          "y": 30,
          "width": 206,
          "height": 60
        }
      }
    ],
    "exceptions": [],
    "levels": [
      {
        "level": "1",
        "experience": "경험치 10% 추가",
        "benefit": "이펙트 추가"
      },
      {
        "level": "10",
        "experience": "경험치 20% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "20",
        "experience": "경험치 30% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "30",
        "experience": "경험치 50% 추가",
        "benefit": "외형 / 이펙트 변경  /  럼블모드 사용 가능(럼블모드 시 교체/재장전 시간 단축) - 윈체스터는 재장전 시간만 단축"
      },
      {
        "level": "40",
        "experience": "경험치 70% 추가",
        "benefit": "외형 / 이펙트 변경  /  럼블모드 사용 가능 (럼블모드 시 교체/재장전 시간 단축 + 추가 이펙트 적용) - 윈체스터는 재장전 시간만 단축  /  교체/재장전 사운드 감소"
      },
      {
        "level": "50",
        "experience": "경험치 100% 추가",
        "benefit": "Lv.40 혜택 유지  /  무기/손 반투명 적용"
      }
    ],
    "english": "Rumble",
    "tagline": "모드를 바꿔 장전과 교체를 빠르게",
    "category": "모드 전환",
    "minLevel": 30,
    "trigger": "특수기능 6으로 럼블모드 전환",
    "triggerDetail": "기본 단축키는 마우스 휠 클릭입니다.",
    "persistence": "럼블모드 적용 중",
    "effect": "모드에서 교체·재장전이 빨라집니다.",
    "note": "Lv.40에는 교체·재장전 소리가 감소합니다. 윈체스터는 재장전 시간만 단축됩니다.",
    "color": "#f29370"
  },
  {
    "id": "double",
    "name": "더블",
    "source": "https://guide.sa.nexon.com/guide/45#toc-32",
    "checkedAt": "2026-11-05",
    "guns": [
      {
        "name": "[M]FAMAS(I) Double / [M]FAMAS(IS) Double",
        "base": "FAMAS",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/double/[M]FAMAS(IS)_Double.png",
        "image": "images/double-01.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]AK103(I) Double / [M]AK103(IS) Double",
        "base": "AK103",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/double/[M]AK103(IS)_Double.png",
        "image": "images/double-02.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]SIG556(I) Double / [M]SIG556(IS) Double",
        "base": "SIG556",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/double/[M]SIG556(IS)_Double.png",
        "image": "images/double-03.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]M4A1(I) Double / [M]M4A1(IS) Double",
        "base": "M4A1",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/double/[M]M4A1(IS)_Double.png",
        "image": "images/double-04.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]UAR_v2(I) Double / [M]UAR_v2(IS) Double",
        "base": "UAR_v2",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/double/[M]UAR_v2(IS)_Double.png",
        "image": "images/double-05.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]AK47(IK) Light Double / [M]AK47(IK) Heavy Double",
        "base": "AK47",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/double/[M]AK47_Heavy(IK)_Double.png",
        "image": "images/double-06.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]HK416_v2(I) Double / [M]HK416_v2(IS) Double",
        "base": "HK416_v2",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/double/[M]HK416_v2(IS)_Double.png",
        "image": "images/double-07.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]TRG21(I) Double / [M]TRG21(IS) Double",
        "base": "TRG21",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/double/[M]TRG21(IS)_Double.png",
        "image": "images/double-08.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]GSR-6(I) Double / [M]GSR-6(IS) Double",
        "base": "GSR-6",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/double/[M]GSR-6(IS)_Double.png",
        "image": "images/double-09.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]AWP(I) Double / [M]AWP(IS) Double",
        "base": "AWP",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/double/[M]AWP(IS)_Double.png",
        "image": "images/double-10.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]SG-12(I) Double / [M]SG-12(IS) Double",
        "base": "SG-12",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/double/[M]SG-12(IS)_Double.png",
        "image": "images/double-11.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]G18 Double / [M]G18(S) Double",
        "base": "G18",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/double/[M]G18(S)_Double.png",
        "image": "images/double-12.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]Peacemaker Double / [M]Peacemaker(S) Double",
        "base": "Peacemaker",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/double/[M]Peacemaker(S)_Double.png",
        "image": "images/double-13.webp",
        "width": 311,
        "height": 150
      }
    ],
    "sets": [
      {
        "count": "3",
        "reward": "[M]BombTechkitⅡ Double (Lv.50)",
        "effect": "교체 시간 단축",
        "image": "images/rewards/double-01.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/double/[M]BombTechkit%E2%85%A1_Double_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 122,
          "y": 29,
          "width": 66,
          "height": 62
        }
      },
      {
        "count": "6",
        "reward": "[M]G600 Double (Lv.50)",
        "effect": "교체/사용 시간 단축 · 특수기능6으로 모드 전환 시, Dynamite 성능으로 변경",
        "image": "images/rewards/double-02.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/double/[M]G600_Double_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 120,
          "y": 25,
          "width": 70,
          "height": 70
        }
      },
      {
        "count": "9",
        "reward": "[M]윈체스터(IS) Double (Lv.50)",
        "effect": "더블모드 사용 가능 (더블모드 시 재장전 시간 소폭 단축) · 장전탄약 +1",
        "image": "images/rewards/double-03.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/double/[M]Winchester(IS)_Double_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 45,
          "y": 38,
          "width": 220,
          "height": 44
        }
      },
      {
        "count": "12",
        "reward": "[M]MSR-200(IS) Double (Lv.50)",
        "effect": "교체 시간 단축 · 더블모드 사용 가능 (더블모드 시 재장전 시간 소폭 단축) · 장전탄약 +1",
        "image": "images/rewards/double-04.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/double/[M]MSR-200(IS)_Double_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 35,
          "y": 37,
          "width": 240,
          "height": 46
        }
      }
    ],
    "exceptions": [],
    "levels": [
      {
        "level": "1",
        "experience": "경험치 10% 추가",
        "benefit": "이펙트 추가"
      },
      {
        "level": "10",
        "experience": "경험치 20% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "20",
        "experience": "경험치 30% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "30",
        "experience": "경험치 50% 추가",
        "benefit": "외형 / 이펙트 변경  /  더블모드 사용 가능 (더블모드 시 재장전 시간 소폭 단축)"
      },
      {
        "level": "40",
        "experience": "경험치 70% 추가",
        "benefit": "외형 / 이펙트 변경  /  더블모드 사용 가능 (더블모드 시 재장전 시간 소폭 단축)  /  교체 시간 단축  /  장전탄약 +1"
      },
      {
        "level": "50",
        "experience": "경험치 100% 추가",
        "benefit": "Lv.40 혜택 유지  /  무기/손 반투명 적용"
      }
    ],
    "english": "Double",
    "tagline": "더블모드와 장탄수 혜택",
    "category": "모드 전환",
    "minLevel": 30,
    "trigger": "특수기능 6으로 더블모드 전환",
    "triggerDetail": "기본 단축키는 마우스 휠 클릭입니다.",
    "persistence": "더블모드 적용 중",
    "effect": "모드에서 재장전 시간이 조금 줄어듭니다.",
    "note": "Lv.40에는 교체 시간 단축과 장전탄약 +1이 적용됩니다.",
    "color": "#77cee3"
  },
  {
    "id": "evil",
    "name": "이블",
    "source": "https://guide.sa.nexon.com/guide/45#toc-36",
    "checkedAt": "2026-11-05",
    "guns": [
      {
        "name": "[M]AK47(I) Evil / [M]AK47(IK) Evil",
        "base": "AK47",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evil/[M]AK47(IK)_Evil.png",
        "image": "images/evil-01.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]SCAR_v2(I) Evil / [M]SCAR_v2(IS) Evil",
        "base": "SCAR_v2",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evil/[M]SCAR_v2(IS)_Evil.png",
        "image": "images/evil-02.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]SIG556(I) Evil / [M]SIG556(IS) Evil",
        "base": "SIG556",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evil/[M]SIG556(IS)_Evil.png",
        "image": "images/evil-03.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]윈체스터(I) Evil / [M]윈체스터(IS) Evil",
        "base": "윈체스터",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evil/[M]Winchester(IS)_Evil.png",
        "image": "images/evil-04.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]TRG21(I) Evil / [M]TRG21(IS) Evil",
        "base": "TRG21",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evil/[M]TRG21(IS)_Evil.png",
        "image": "images/evil-05.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]AWP(I) Evil / [M]AWP(IS) Evil",
        "base": "AWP",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evil/[M]AWP(IS)_Evil.png",
        "image": "images/evil-06.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]Mak-12(I) Evil / [M]Mak-12(IS) Evil",
        "base": "Mak-12",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evil/[M]Mak-12(IS)_Evil.png",
        "image": "images/evil-07.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]SG-12(I) Evil / [M]SG-12(IS) Evil",
        "base": "SG-12",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evil/[M]SG-12(IS)_Evil.png",
        "image": "images/evil-08.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]Peacemaker Evil / [M]Peacemaker(S) Evil",
        "base": "Peacemaker",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evil/[M]Peacemaker(S)_Evil.png",
        "image": "images/evil-09.webp",
        "width": 311,
        "height": 150
      }
    ],
    "sets": [
      {
        "count": "3",
        "reward": "[M]G350 Evil (Lv.50)",
        "effect": "교체/사용 시간 단축 · 우 클릭 시 굴려서 투척 가능",
        "image": "images/rewards/evil-01.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evil/[M]G350_Evil_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 122,
          "y": 23,
          "width": 66,
          "height": 74
        }
      },
      {
        "count": "3",
        "reward": "[M]Dynamite Evil (Lv.50)",
        "effect": "교체/사용 시간 단축 · 우 클릭 시 굴려서 투척 가능",
        "image": "images/rewards/evil-02.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evil/[M]Dynamite_Evil_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 122,
          "y": 21,
          "width": 66,
          "height": 78
        }
      },
      {
        "count": "6",
        "reward": "[M]전기충격기 Evil (Lv.50)",
        "effect": "교체/좌클릭 공격 시간 단축 · 특수기능6으로 특수모션 사용 가능",
        "image": "images/rewards/evil-03.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evil/[M]StunGun_Evil_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 137,
          "y": 16,
          "width": 36,
          "height": 88
        }
      },
      {
        "count": "6",
        "reward": "[M]G18(S) Evil (Lv.50)",
        "effect": "장탄수 +3 · 특수기능6으로 특수모션 사용 가능",
        "image": "images/rewards/evil-04.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evil/[M]G18(S)_Evil_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 90,
          "y": 35,
          "width": 130,
          "height": 50
        }
      },
      {
        "count": "9",
        "reward": "스카우터4 Evil (Lv.50)",
        "effect": "게임 내 아군 HP, 저격/투척무기 확인, 아군 사망 표시 기능 적용 · 게임 내 Ctrl + F4키로 아군 사망 표시 기능 On/Off 가능 · 클랜전 최근 동향 정보 기능 적용",
        "image": "images/rewards/evil-05.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evil/[M]Scouter_Evil.png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 100,
          "y": 33,
          "width": 110,
          "height": 54
        }
      },
      {
        "count": "9",
        "reward": "[M]R100 Evil (Lv.50)",
        "effect": "교체/사용 시간 단축 · 레이더 지속 시간/적 탐지 시간 증가",
        "image": "images/rewards/evil-06.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/evil/[M]R100_Evil_(Lv.50).png",
        "width": 310,
        "height": 162,
        "imageBounds": {
          "x": 121,
          "y": 47,
          "width": 68,
          "height": 69
        }
      }
    ],
    "exceptions": [
      "윈체스터는 재장전 시간만 단축"
    ],
    "levels": [
      {
        "level": "1",
        "experience": "경험치 10% 추가",
        "benefit": "특수기능6으로 특수모션 사용 가능"
      },
      {
        "level": "10",
        "experience": "경험치 20% 추가",
        "benefit": "외형 / 이펙트 변경  /  특수기능6으로 특수모션 사용 가능"
      },
      {
        "level": "20",
        "experience": "경험치 30% 추가",
        "benefit": "외형 / 이펙트 변경  /  특수기능6으로 특수모션 사용 가능"
      },
      {
        "level": "30",
        "experience": "경험치 50% 추가",
        "benefit": "외형 / 이펙트 변경  /  특수기능6으로 특수모션 사용 가능"
      },
      {
        "level": "40",
        "experience": "경험치 70% 추가",
        "benefit": "외형 / 이펙트 변경  /  교체/재장전 시간 단축 - 윈체스터는 재장전 시간만 단축 - G18은 장탄수 +3으로 대체  /  특수기능6으로 특수모션 사용 가능"
      },
      {
        "level": "50",
        "experience": "경험치 100% 추가",
        "benefit": "Lv.40 혜택 유지  /  무기/손 반투명 적용"
      }
    ],
    "english": "Evil",
    "tagline": "전용 모션과 레벨별 성장",
    "category": "외형·기본 성장",
    "minLevel": 1,
    "trigger": "특수기능 6으로 특수모션",
    "triggerDetail": "공식 레벨 표에서 Lv.1부터 모션을 안내합니다.",
    "persistence": "모션은 입력 시 사용",
    "effect": "Lv.40의 교체·재장전 혜택과 전용 모션을 구분합니다.",
    "note": "모션을 추가 공격이나 피해량 증가로 해석하지 않습니다.",
    "color": "#d49df0"
  },
  {
    "id": "marble",
    "name": "마블",
    "source": "https://guide.sa.nexon.com/guide/45#toc-40",
    "checkedAt": "2026-11-05",
    "guns": [
      {
        "name": "[M]M4A1(I) Marble / [M]M4A1(IS) Marble",
        "base": "M4A1",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/marble/[M]M4A1(IS)_Marble.png",
        "image": "images/marble-01.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]AK47(I) Light Marble / [M]AK47(I) Heavy Marble",
        "base": "AK47",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20260806085624.png",
        "image": "images/marble-02.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]AK103(I) Marble / [M]AK103(IS) Marble",
        "base": "AK103",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/marble/[M]AK103(IS)_Marble.png",
        "image": "images/marble-03.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]NA-94(I) Marble / [M]NA-94(IS) Marble",
        "base": "NA-94",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/marble/[M]NA-94(IS)_Marble.png",
        "image": "images/marble-04.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]FAMAS(I) Marble / [M]FAMAS(IS) Marble",
        "base": "FAMAS",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/marble/[M]FAMAS(IS)_Marble.png",
        "image": "images/marble-05.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]TRG21(I) Marble / [M]TRG21(IS) Marble",
        "base": "TRG21",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/marble/[M]TRG21(IS)_Marble.png",
        "image": "images/marble-06.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]윈체스터(I) Marble / [M]윈체스터(IS) Marble",
        "base": "윈체스터",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/marble/[M]Winchester(IS)_Marble.png",
        "image": "images/marble-07.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]AWP(I) Marble / [M]AWP(IS) Marble",
        "base": "AWP",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/marble/[M]AWP(IS)_Marble.png",
        "image": "images/marble-08.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]GSR-6(I) Marble / [M]GSR-6(IS) Marble",
        "base": "GSR-6",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/marble/[M]GSR-6(IS)_Marble.png",
        "image": "images/marble-09.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]KRISS(I) Marble / [M]KRISS(IS) Marble",
        "base": "KRISS",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/marble/[M]KRISS(IS)_Marble.png",
        "image": "images/marble-10.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]Mak-11(I) Marble / [M]Mak-11(IS) Marble",
        "base": "Mak-11",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/marble/[M]Mak-11(IS)_Marble.png",
        "image": "images/marble-11.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]Peacemaker Marble / [M]Peacemaker(S) Marble",
        "base": "Peacemaker",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/marble/[M]Peacemaker(S)_Marble.png",
        "image": "images/marble-12.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]G18 Marble / [M]G18(S) Marble",
        "base": "G18",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/marble/[M]G18(S)_Marble.png",
        "image": "images/marble-13.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]NA-34(I) Marble / [M]NA-34(IS) Marble",
        "base": "NA-34",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20260820082347.png",
        "image": "images/marble-14.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]MP7(IS) Marble / [M]MP7(IK) Marble",
        "base": "MP7",
        "sourceImage": "https://img.sa.nexon.com/sa/guide/thumbnail_img/20260820082357.png",
        "image": "images/marble-15.webp",
        "width": 310,
        "height": 150
      }
    ],
    "sets": [
      {
        "count": "3",
        "reward": "[M]G600 Marble (Lv.50)",
        "effect": "교체/사용 시간 단축",
        "image": "images/rewards/marble-01.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/marble/[M]G600_Marble_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 121,
          "y": 26,
          "width": 68,
          "height": 68
        }
      },
      {
        "count": "6",
        "reward": "[M]BombTechkitⅡ Marble (Lv.50)",
        "effect": "교체 시간 단축",
        "image": "images/rewards/marble-02.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/marble/[M]BombTechkit%E2%85%A1_Marble_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 125,
          "y": 22,
          "width": 60,
          "height": 76
        }
      },
      {
        "count": "9",
        "reward": "[M]Knife Marble (Lv.50)",
        "effect": "교체/우클릭 공격 시간 단축 · 대미지/사거리 증가",
        "image": "images/rewards/marble-03.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/marble/[M]Knife_Marble_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 90,
          "y": 47,
          "width": 130,
          "height": 26
        }
      }
    ],
    "exceptions": [
      "윈체스터는 재장전 시간만 단축",
      "G18은 장탄수 +3으로 대체"
    ],
    "levels": [
      {
        "level": "1",
        "experience": "경험치 10% 추가",
        "benefit": "이펙트 추가"
      },
      {
        "level": "10",
        "experience": "경험치 20% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "20",
        "experience": "경험치 30% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "30",
        "experience": "경험치 50% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "40",
        "experience": "경험치 70% 추가",
        "benefit": "외형 / 이펙트 변경  /  교체/재장전 시간 단축 - 윈체스터는 재장전 시간만 단축 - G18은 장탄수 +3으로 대체"
      },
      {
        "level": "50",
        "experience": "경험치 100% 추가",
        "benefit": "Lv.40 혜택 유지  /  무기/손 반투명 적용"
      }
    ],
    "english": "Marble",
    "tagline": "레벨별 기본 혜택을 확인하세요",
    "category": "외형·기본 성장",
    "minLevel": 40,
    "trigger": "레벨 도달",
    "triggerDetail": "기본 시리즈 레벨별 혜택으로 구분합니다.",
    "persistence": "해당 레벨 혜택 적용",
    "effect": "Lv.40 교체·재장전, Lv.50 무기·손 반투명입니다.",
    "note": "윈체스터·G18 등의 예외는 아래 레벨 표를 확인하세요. 별도 특수 공격은 공식 시리즈 소개에 기재되지 않았습니다.",
    "color": "#e8b0be"
  },
  {
    "id": "noble",
    "name": "노블",
    "source": "https://guide.sa.nexon.com/guide/45#toc-44",
    "checkedAt": "2026-11-05",
    "guns": [
      {
        "name": "[M]AK47(I) Noble / [M]AK47(IK) Noble",
        "base": "AK47",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/noble/[M]AK47(IK)_Noble.png",
        "image": "images/noble-01.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]M4A1(I) Noble / [M]M4A1(IS) Noble",
        "base": "M4A1",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/noble/[M]M4A1(IS)_Noble.png",
        "image": "images/noble-02.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]NA-94(I) Noble / [M]NA-94(IS) Noble",
        "base": "NA-94",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/noble/[M]NA-94(IS)_Noble.png",
        "image": "images/noble-03.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]AK103(I) Noble / [M]AK103(IS) Noble",
        "base": "AK103",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/noble/[M]AK103(IS)_Noble.png",
        "image": "images/noble-04.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]FAMAS(I) Noble / [M]FAMAS(IS) Noble",
        "base": "FAMAS",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/noble/[M]FAMAS(IS)_Noble.png",
        "image": "images/noble-05.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]TRG21(I) Noble / [M]TRG21(IS) Noble",
        "base": "TRG21",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/noble/[M]TRG21(IS)_Noble.png",
        "image": "images/noble-06.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]윈체스터(I) Noble / [M]윈체스터(IS) Noble",
        "base": "윈체스터",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/noble/[M]Winchester(IS)_Noble.png",
        "image": "images/noble-07.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]AWP(I) Noble / [M]AWP(IS) Noble",
        "base": "AWP",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/noble/[M]AWP(IS)_Noble.png",
        "image": "images/noble-08.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]KRISS(I) Noble / [M]KRISS(IS) Noble",
        "base": "KRISS",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/noble/[M]KRISS(IS)_Noble.png",
        "image": "images/noble-09.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]SG-12(I) Noble / [M]SG-12(IS) Noble",
        "base": "SG-12",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/noble/[M]SG-12(IS)_Noble.png",
        "image": "images/noble-10.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]G18 Noble / [M]G18(S) Noble",
        "base": "G18",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/noble/[M]G18(S)_Noble.png",
        "image": "images/noble-11.webp",
        "width": 311,
        "height": 150
      },
      {
        "name": "[M]Peacemaker Noble / [M]Peacemaker(S) Noble",
        "base": "Peacemaker",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/noble/[M]Peacemaker(S)_Noble.png",
        "image": "images/noble-12.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]DRT-6(I) Noble / [M]DRT-6(IS) Noble",
        "base": "DRT-6",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/noble/[M]DRT-6_(IS)_Noble.png",
        "image": "images/noble-13.webp",
        "width": 310,
        "height": 150
      },
      {
        "name": "[M]GAL-1_v2(IS) Noble / [M]GAL-1_v2(IK) Noble",
        "base": "GAL-1_v2",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/noble/[M]GAL-1(IK)_Noble.png",
        "image": "images/noble-14.webp",
        "width": 310,
        "height": 150
      }
    ],
    "sets": [
      {
        "count": "5",
        "reward": "[M]G600 Noble (Lv.50)",
        "effect": "교체/사용 시간 단축",
        "image": "images/rewards/noble-01.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/noble/[M]G600_Noble_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 120,
          "y": 25,
          "width": 70,
          "height": 70
        }
      },
      {
        "count": "10",
        "reward": "[M]Petit Knife(S) Noble (Lv.50)",
        "effect": "교체/우클릭 공격 시간 단축 · 대미지/사거리 증가",
        "image": "images/rewards/noble-02.png",
        "sourceImage": "https://img.sa.nexon.com/sa/infoCenter/gameGuide/mygun2/noble/[M]Petit_Knife(S)_Noble_(Lv.50).png",
        "width": 310,
        "height": 110,
        "imageBounds": {
          "x": 80,
          "y": 50,
          "width": 150,
          "height": 20
        }
      }
    ],
    "exceptions": [
      "윈체스터는 재장전 시간만 단축",
      "G18은 장탄수 +3으로 대체"
    ],
    "levels": [
      {
        "level": "1",
        "experience": "경험치 10% 추가",
        "benefit": ""
      },
      {
        "level": "10",
        "experience": "경험치 20% 추가",
        "benefit": "무기 외형 변경"
      },
      {
        "level": "20",
        "experience": "경험치 30% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "30",
        "experience": "경험치 50% 추가",
        "benefit": "외형 / 이펙트 변경"
      },
      {
        "level": "40",
        "experience": "경험치 70% 추가",
        "benefit": "외형 / 이펙트 변경  /  교체/재장전 시간 단축 - 윈체스터는 재장전 시간만 단축 - G18은 장탄수 +3으로 대체"
      },
      {
        "level": "50",
        "experience": "경험치 100% 추가",
        "benefit": "Lv.40 혜택 유지  /  무기/손 반투명 적용"
      }
    ],
    "english": "Noble",
    "tagline": "기본 성장과 개조를 구분해서",
    "category": "외형·기본 성장",
    "minLevel": 40,
    "trigger": "레벨 도달 / 대상 총기별 개조",
    "triggerDetail": "아래 표는 기본 레벨 1~50 안내입니다. 개조 가능 총기와 조건은 별도로 확인해야 합니다.",
    "persistence": "기본 혜택은 해당 레벨 적용",
    "effect": "Lv.40 교체·재장전, Lv.50 무기·손 반투명입니다.",
    "note": "노블의 개조는 모든 총기에 자동 적용되지 않습니다. 개조 대상·재료·확장 레벨은 공식 개조 안내를 확인하세요.",
    "color": "#b7c5d9"
  }
];
